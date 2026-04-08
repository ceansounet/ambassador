import type { ComponentProps } from "react";
import Image from "next/image";
import sep from "@/assets/landing/sep.png";

const Sep = ({
  className = "",
  ...props
}: Omit<ComponentProps<typeof Image>, "src" | "alt">) => (
  <Image
    {...props}
    src={sep}
    alt=""
    role="presentation"
    className={`w-full h-auto ${className}`}
    sizes="100vw"
  />
);

export default Sep;
