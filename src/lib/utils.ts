import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** twMerge non conosce i nomi delle nostre due ombre (DESIGN.md): senza questa
 *  estensione `cn("shadow-md", "shadow-galleggiante")` le terrebbe tutte e due. */
const twMerge = extendTailwindMerge({
  extend: { classGroups: { shadow: [{ shadow: ["galleggiante", "alone"] }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
