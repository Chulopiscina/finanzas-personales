export const currencyFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR"
});

export const numberFormatter = new Intl.NumberFormat("es-ES");

export const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric"
});

export const monthFormatter = new Intl.DateTimeFormat("es-ES", {
  month: "short",
  year: "2-digit"
});

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return "-";
  }

  return dateFormatter.format(new Date(value));
}
