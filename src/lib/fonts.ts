import { Instrument_Sans, Jersey_25 } from "next/font/google";

export const instrumentSans = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const jersey25 = Jersey_25({
  variable: "--font-jersey",
  weight: "400",
  subsets: ["latin"],
});
