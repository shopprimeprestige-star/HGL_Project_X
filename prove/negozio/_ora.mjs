/** «HH:MM» in ora del browser, come la scrive `oraHHmm`: serve alle prove per non dipendere dal fuso. */
export const oraDi = (ms) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
