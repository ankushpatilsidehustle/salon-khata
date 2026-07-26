declare module "react-native-razorpay" {
  type CheckoutOptions = Record<string, unknown>;
  type CheckoutResult = Record<string, unknown>;

  const RazorpayCheckout: {
    open: (options: CheckoutOptions) => Promise<CheckoutResult>;
  };

  export default RazorpayCheckout;
}
