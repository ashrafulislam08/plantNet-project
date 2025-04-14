require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const morgan = require("morgan");

const port = process.env.PORT || 9000;
const app = express();
// middleware
const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2xsor.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    const db = client.db("plant-net");
    const usersCollection = db.collection("users");
    const plantsCollection = db.collection("plants");
    const ordersCollection = db.collection("orders");

    // verify admin middleware
    const verifyAdmin = async (req, res, next) => {
      const email = req.user?.email;
      const query = { email };
      const result = await usersCollection.findOne(query);
      if (!result || result?.role !== "admin")
        return res
          .status(403)
          .send({ message: "Forbidden access! Admins Only Actions" });

      next();
    };
    // verify seller middleware
    const verifySeller = async (req, res, next) => {
      const email = req.user?.email;
      const query = { email };
      const result = await usersCollection.findOne(query);
      if (!result || result?.role !== "seller")
        return res
          .status(403)
          .send({ message: "Forbidden access! Seller Only Actions" });

      next();
    };

    // save  user
    app.post("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;

      // check if user exist
      const isExist = await usersCollection.findOne({ email });
      if (isExist) {
        return res.send(isExist);
      }

      const result = await usersCollection.insertOne({
        ...user,
        role: "customer",
        timestamp: Date.now(),
      });
      res.send(result);
    });

    // manage user status and role
    app.patch("/users/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      if (!user || user?.status === "Requested") {
        return res
          .status(400)
          .send("You have already requested, wait for some time");
      }

      const updatedDoc = {
        $set: {
          status: "Requested",
        },
      };

      const result = await usersCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    // get user role
    app.get("/users/role/:email", async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      res.send({ role: result?.role });
    });

    // get inventory data for seller
    app.get(
      "/plants/seller/:email",
      verifyToken,
      verifySeller,
      async (req, res) => {
        const email = req.params.email;
        const result = await plantsCollection
          .find({
            "seller.email": email,
          })
          .toArray();
        res.send(result);
      }
    );

    app.delete("/plants/:id", verifyToken, verifySeller, async (req, res) => {
      const id = req.params.id;
      const result = await plantsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // get all users
    app.get("/all-users/:email", verifyToken, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const query = { email: { $ne: email } };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    //  update a user role and status
    app.patch(
      "/user/role/:email",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        const { role } = req.body;
        const filter = { email };
        const updatedDoc = {
          $set: {
            role,
            status: "Verified",
          },
        };
        const result = await usersCollection.updateOne(filter, updatedDoc);
        res.send(result);
      }
    );

    // Generate jwt token
    app.post("/jwt", async (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });
    // Logout
    app.get("/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", {
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
      } catch (err) {
        res.status(500).send(err);
      }
    });

    // save a plant data to db
    app.post("/plants", verifyToken, verifySeller, async (req, res) => {
      const newPlant = req.body;
      const result = await plantsCollection.insertOne(newPlant);
      res.send(result);
    });

    // get all plants from db
    app.get("/plants", async (req, res) => {
      const result = await plantsCollection.find().toArray();
      res.send(result);
    });

    // get a plant data by id
    app.get("/plants/:id", async (req, res) => {
      const result = await plantsCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });

    // post order route
    app.post("/order", verifyToken, async (req, res) => {
      const plantInfo = req.body;
      console.log(plantInfo);
      const result = await ordersCollection.insertOne(plantInfo);
      res.send(result);
    });

    // manage plants quantity
    app.patch("/plants/quantity/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const { quantityToUpdate, status } = req.body;
      const filter = { _id: new ObjectId(id) };
      let updatedDoc = {
        $inc: {
          quantity: -quantityToUpdate,
        },
      };

      if (status == "increase") {
        updatedDoc = {
          $inc: {
            quantity: quantityToUpdate,
          },
        };
      }

      const result = await plantsCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // get all customer orders
    app.get("/customer-orders/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { "customer.email": email };
      const result = await ordersCollection
        .aggregate([
          {
            $match: query,
          },
          {
            $addFields: {
              plantId: { $toObjectId: "$plantId" },
            },
          },
          {
            $lookup: {
              from: "plants",
              localField: "plantId",
              foreignField: "_id",
              as: "plants",
            },
          },
          {
            $unwind: "$plants",
          },
          {
            $addFields: {
              name: "$plants.name",
              image: "$plants.image",
              category: "$plants.category",
            },
          },
          {
            $project: {
              plants: 0,
            },
          },
        ])
        .toArray();
      res.send(result);
    });
    // get all customer orders
    app.get(
      "/seller-orders/:email",
      verifyToken,
      verifySeller,
      async (req, res) => {
        const email = req.params.email;
        const query = { "seller.email": email };
        const result = await ordersCollection
          .aggregate([
            {
              $match: { seller: email },
            },
            {
              $addFields: {
                plantId: { $toObjectId: "$plantId" },
              },
            },
            {
              $lookup: {
                from: "plants",
                localField: "plantId",
                foreignField: "_id",
                as: "plants",
              },
            },
            {
              $unwind: "$plants",
            },
            {
              $addFields: {
                name: "$plants.name",
              },
            },
            {
              $project: {
                plants: 0,
              },
            },
          ])
          .toArray();
        res.send(result);
      }
    );

    // update order status
    app.patch("/orders/:id", verifyToken, verifySeller, async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: { status },
      };

      const result = await ordersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // cancel or delete an order
    app.delete("/orders/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const order = await ordersCollection.findOne(query);
      if (order.status === "delivered")
        return res.status(409).send("Cannot cancel once the product delivered");
      const result = await ordersCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from plantNet Server..");
});

app.listen(port, () => {
  console.log(`plantNet is running on port ${port}`);
});
