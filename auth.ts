// app/api/auth/[...nextauth]/route.ts or app/api/auth/[...nextauth]/auth.ts
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth.config";

const handler = NextAuth(authOptions);

export const {
  auth,
  handlers: { GET, POST },
} = handler;
