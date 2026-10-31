import { PolicyPage, policyMetadata } from "@/components/policy-page";

export const generateMetadata = () => policyMetadata("contact");

export default function Page() {
  return <PolicyPage slug="contact" />;
}
