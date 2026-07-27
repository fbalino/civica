import type { Metadata } from "next";
import ContactClient from "./ContactClient";
import { withOg } from "@/lib/og";
import "./contact.css";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Contact the editors",
  description:
    "Send a data correction, research question, press inquiry, or collaboration proposal. Fernando Baliño reviews submissions manually.",
  alternates: { canonical: "https://civicaatlas.org/contact" },
  openGraph: withOg({
    title: "Contact the editors · Civica Atlas",
    description:
      "Send a data correction, research question, press inquiry, or collaboration proposal. Fernando Baliño reviews submissions manually.",
    url: "https://civicaatlas.org/contact",
  }),
};

export default function ContactPage() {
  return <ContactClient />;
}
