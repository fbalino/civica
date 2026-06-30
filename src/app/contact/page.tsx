import type { Metadata } from "next";
import ContactClient from "./ContactClient";
import { withOg } from "@/lib/og";
import "./contact.css";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Contact the Editors",
  description:
    "Send a message to the Civica editorial team — data corrections, story tips, partnerships, press inquiries, and more.",
  alternates: { canonical: "https://civicaatlas.org/contact" },
  openGraph: withOg({
    title: "Contact the Editors | Civica",
    description:
      "Send a message to the Civica editorial team — data corrections, story tips, partnerships, press inquiries, and more.",
    url: "https://civicaatlas.org/contact",
  }),
};

export default function ContactPage() {
  return <ContactClient />;
}
