// app/login/page.tsx
import { Button } from "@/components/ui/button";
import { GitHubLogoIcon, LinkedInLogoIcon } from "@radix-ui/react-icons";
import { FcGoogle } from "react-icons/fc";
import { AuthError } from "next-auth";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const error = searchParams.error;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Welcome to Jobsynt</h1>
          <p className="text-gray-500 mt-2">
            Streamline your job search with AI-powered tools
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
            {getErrorMessage(error)}
          </div>
        )}

        <div className="space-y-4">
          <form action="/api/auth/signin/google" method="POST" className="w-full">
            <Button
              type="submit"
              variant="outline"
              className="w-full gap-2 border-gray-300 hover:bg-gray-50"
            >
              <FcGoogle className="w-5 h-5" />
              Continue with Google
            </Button>
          </form>

          <form action="/api/auth/signin/github" method="POST" className="w-full">
            <Button
              type="submit"
              variant="outline"
              className="w-full gap-2 border-gray-300 hover:bg-gray-50"
            >
              <GitHubLogoIcon className="w-5 h-5" />
              Continue with GitHub
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or</span>
            </div>
          </div>

          <Button className="w-full bg-indigo-600 hover:bg-indigo-700">
            Continue with Email
          </Button>
        </div>

        <p className="text-center text-sm text-gray-500">
          By continuing, you agree to our{" "}
          <a href="#" className="font-medium text-indigo-600 hover:underline">
            Terms
          </a>{" "}
          and{" "}
          <a href="#" className="font-medium text-indigo-600 hover:underline">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}

function getErrorMessage(error: string) {
  switch (error) {
    case "OAuthAccountNotLinked":
      return "This email is already linked with another provider";
    case "OAuthCallback":
      return "Error during authentication. Please try again.";
    default:
      return "Authentication failed. Please try again.";
  }
}