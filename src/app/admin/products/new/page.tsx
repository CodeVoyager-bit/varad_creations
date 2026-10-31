import EditProduct from "../[id]/page";

export const metadata = { title: "New product" };

export default function NewProduct() {
  return <EditProduct params={Promise.resolve({ id: "new" })} searchParams={Promise.resolve({})} />;
}
