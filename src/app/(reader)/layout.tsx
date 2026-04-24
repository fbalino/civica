import { ReaderHeader } from "@/components/ReaderHeader";

export default function ReaderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ReaderHeader />
      {children}
    </>
  );
}
