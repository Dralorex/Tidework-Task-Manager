import type { Metadata } from "next";
import { Fraunces, Nunito } from "next/font/google";
import { cookies } from "next/headers";
import { THEME_COOKIE, parseDisplayTheme } from "@/lib/theme";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
});

const body = Nunito({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tidework Task Manager",
  description:
    "Claim work as the tide rises. Nested folders, urgency that pulls due tasks up, friends, and private chats.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieStore = await cookies();
  const theme = parseDisplayTheme(cookieStore.get(THEME_COOKIE)?.value);

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
