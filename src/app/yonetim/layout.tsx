import YonetimClientLayout from "./YonetimClientLayout";

export const dynamic = "force-dynamic";

export default function YonetimLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <YonetimClientLayout>{children}</YonetimClientLayout>;
}
