import React from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../services/firebaseService";
import { sendEmailVerification, reload } from "firebase/auth";
import { Button } from "../components/ui/button";
import { useToast } from "../hooks/use-toast";

const VerifyEmailPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleResend = async () => {
    const user = auth.currentUser;
    if (!user) {
      navigate("/auth");
      return;
    }
    try {
      await sendEmailVerification(user);
      toast({
        title: "Verification email sent",
        description: `We've emailed a verification link to ${user.email}. Please check your inbox (and spam folder).`,
      });
    } catch (error) {
      console.error("Error resending verification email:", error);
      toast({
        title: "Could not resend email",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    }
  };

  const handleCheckVerified = async () => {
    const user = auth.currentUser;
    if (!user) {
      navigate("/auth");
      return;
    }
    try {
      await reload(user);
      if (user.emailVerified) {
        toast({
          title: "Email verified",
          description: "Thanks for confirming your email. You can now use your dashboard.",
        });
        navigate("/");
      } else {
        toast({
          title: "Not verified yet",
          description: "We still don't see your email as verified. Please click the link in your inbox.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error checking verification status:", error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f3f4f6] px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Verify your email</h1>
        <p className="text-sm text-gray-600">
          We’ve sent a verification link to your email address. Please click the link in that email
          to activate your account before continuing.
        </p>
        <div className="space-y-3 mt-4">
          <Button className="w-full" onClick={handleResend}>
            Resend Verification Email
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleCheckVerified}
          >
            I’ve verified my email
          </Button>
        </div>
        <button
          className="mt-4 text-xs text-gray-500 underline"
          onClick={() => navigate("/auth")}
        >
          Back to sign in
        </button>
      </div>
    </div>
  );
};

export default VerifyEmailPage;

