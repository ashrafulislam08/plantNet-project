/* eslint-disable react/prop-types */
import {
  Dialog,
  Transition,
  TransitionChild,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { Fragment, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import useAxiosSecure from "../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import Button from "../Shared/Button/Button";

const PurchaseModal = ({ plant, closeModal, isOpen, refetch }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { category, price, name, seller, quantity, _id } = plant;

  const axiosSecure = useAxiosSecure();
  const [totalQuantity, setTotalQuantity] = useState(1);
  const [totalPrice, setTotalPrice] = useState(price);
  const [purchaseInfo, setPurchaseInfo] = useState({
    customer: {
      name: user?.displayName,
      email: user?.email,
      image: user?.photoURL,
    },
    plantId: _id,
    price: totalPrice,
    quantity: totalQuantity,
    address: "",
    seller: seller?.email,
    status: "Pending",
  });

  const handleQuantity = (value) => {
    if (value > quantity) {
      setTotalQuantity(quantity);
      return toast.error("Quantity exceeds available stock!");
    }

    if (value < 0) {
      setTotalQuantity(1);
      return toast.error("Quantity cannot be less than 1");
    }

    setTotalQuantity(value);
    setTotalPrice(value * price);
    setPurchaseInfo((prev) => {
      return { ...prev, quantity: value, price: value * price };
    });
  };

  const handlePurchase = async (e) => {
    e.preventDefault();
    // post request in db
    try {
      await axiosSecure.post("/order", purchaseInfo);
      await axiosSecure.patch(`/plants/quantity/${_id}`, {
        quantityToUpdate: totalQuantity,
        status: "decrease",
      });
      toast.success("Order placed successfully");
      navigate("/dashboard/my-orders");
      refetch();
    } catch (error) {
      console.log(error);
    } finally {
      closeModal();
    }
  };

  // Total Price Calculation

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={closeModal}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <DialogTitle
                  as="h3"
                  className="text-lg font-medium text-center leading-6 text-gray-900"
                >
                  Review Info Before Purchase
                </DialogTitle>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">Plant: {name}</p>
                </div>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">Category: {category}</p>
                </div>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    Customer: {user?.displayName}
                  </p>
                </div>

                <div className="mt-2">
                  <p className="text-sm text-gray-500">Price: ${price}</p>
                </div>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    Available Quantity: {quantity}
                  </p>
                </div>
                {/* quantity input field */}
                <div className="space-x-2 mt-2 text-sm">
                  <label className="text-gray-600" htmlFor="quantity">
                    Quantity:{" "}
                  </label>
                  <input
                    type="number"
                    value={totalQuantity}
                    onChange={(e) => handleQuantity(parseInt(e.target.value))}
                    className="p-2 text-gray-800 border border-lime-300 focus:outline-lime-500 rounded-md bg-white"
                    name="quantity"
                    id="quantity"
                    placeholder="Available quantity"
                    required
                  />
                </div>
                <div className="space-x-2 mt-2 text-sm">
                  <label htmlFor="address" className=" text-gray-600">
                    Address:
                  </label>
                  <input
                    className="p-2 text-gray-800 border border-lime-300 focus:outline-lime-500 rounded-md bg-white"
                    name="address"
                    id="address"
                    onChange={(e) =>
                      setPurchaseInfo((prv) => {
                        return { ...prv, address: e.target.value };
                      })
                    }
                    type="text"
                    placeholder="Shipping Address.."
                    required
                  />
                </div>
                <div className="mt-3">
                  <Button
                    onClick={handlePurchase}
                    label={`Pay $${totalPrice || 0}`}
                  />
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default PurchaseModal;
