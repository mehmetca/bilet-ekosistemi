import YonetimClientLayout from "./YonetimClientLayout";
import YonetimIntlProvider from "./YonetimIntlProvider";

/** i18n istemci tarafında (YonetimIntlProvider); sunucuda headers/force-dynamic yok. */
export default function YonetimLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <YonetimIntlProvider>
      <YonetimClientLayout>{children}</YonetimClientLayout>
    </YonetimIntlProvider>
  );
}
