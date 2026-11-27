import { Button, ButtonGroup } from "@nextui-org/react";
import { getProduct, Product, productName, switchProduct, travelAvailable } from "@/utils/product";

/** Visa CRM / Travel CRM switch. Switching signs out (each product has its own login). */
const ProductSwitch = ({ className = "" }: { className?: string }) => {
    if (!travelAvailable()) return null;
    const current = getProduct();
    const pick = (p: Product) => {
        if (p === current) return;
        if (window.confirm(`Switch to the ${productName(p)} admin? You will be signed out and need to log in to the ${productName(p)}.`)) switchProduct(p);
    };
    return (
        <ButtonGroup size="sm" fullWidth className={className}>
            {(["visa", "travel"] as Product[]).map((p) => (
                <Button key={p} color={p === current ? "primary" : "default"} variant={p === current ? "solid" : "flat"} onPress={() => pick(p)}>
                    {productName(p)}
                </Button>
            ))}
        </ButtonGroup>
    );
};

export default ProductSwitch;
