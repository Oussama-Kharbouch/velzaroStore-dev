import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { adminPassword } from "../../../lib/admin/auth";
import { hasAdminSession } from "../../../lib/admin/guard";
import { ADMIN_PATH } from "../../../lib/site";
import LoginForm from "./login-form";

export const metadata: Metadata = { title: "Connexion" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Déjà connecté : inutile de redemander le mot de passe.
  if (await hasAdminSession()) redirect(ADMIN_PATH);
  return <LoginForm configured={Boolean(adminPassword())}/>;
}
