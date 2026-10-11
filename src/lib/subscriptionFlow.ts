import type { Subscription } from "@/lib/database";

/**
 * How a subscription moves money for me:
 * -1 = I pay (outflow), +1 = I receive (inflow), 0 = someone else pays, so it only gets tracked.
 */
export const subscriptionFlow = (sub: Pick<Subscription, "kind" | "paidByMe">): -1 | 0 | 1 => {
  if (sub.kind === "own") return -1;
  if (sub.kind === "other") return sub.paidByMe ? -1 : 0;
  return sub.paidByMe ? -1 : 1;
};

export const SUBSCRIPTION_KIND_LABEL: Record<Subscription["kind"], string> = {
  own: "My subscription",
  other: "Someone else's subscription",
  loan: "Loan with a person",
};
