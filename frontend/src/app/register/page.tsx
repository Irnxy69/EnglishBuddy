"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// /register redirects to /login which has both login and register tabs
export default function RegisterPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/login?mode=register"); }, [router]);
  return null;
}
