import type { Metadata } from "next";
import ContactClient from "./ContactClient";

export const metadata: Metadata = {
  title: "Contact the Editors",
  description:
    "Send a message to the Civica editorial team — data corrections, story tips, partnerships, press inquiries, and more.",
  alternates: { canonical: "https://civicaatlas.org/contact" },
  openGraph: {
    title: "Contact the Editors | Civica",
    description:
      "Send a message to the Civica editorial team — data corrections, story tips, partnerships, press inquiries, and more.",
    url: "https://civicaatlas.org/contact",
  },
};

export default function ContactPage() {
  return <ContactClient />;
}
