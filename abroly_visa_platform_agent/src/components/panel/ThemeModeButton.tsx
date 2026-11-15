import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";
import { Laptop, Moon, Sun } from "lucide-react";
import { ThemeMode, useThemeMode } from "@/lib/themeMode";

/** Top bar: light / dark / follow device. */
const ThemeModeButton = () => {
    const { mode, dark, setThemeMode } = useThemeMode();
    return (
        <Dropdown placement="bottom-end">
            <DropdownTrigger>
                <Button isIconOnly variant="light" size="sm" aria-label="Light or dark mode">{dark ? <Moon size={18} /> : <Sun size={18} />}</Button>
            </DropdownTrigger>
            <DropdownMenu aria-label="Theme" selectionMode="single" selectedKeys={[mode]} disallowEmptySelection
                onSelectionChange={(keys) => setThemeMode(Array.from(keys)[0] as ThemeMode)}>
                <DropdownItem key="light" startContent={<Sun size={16} />}>Light</DropdownItem>
                <DropdownItem key="dark" startContent={<Moon size={16} />}>Dark</DropdownItem>
                <DropdownItem key="system" startContent={<Laptop size={16} />} description="Same as your phone or computer">Device setting</DropdownItem>
            </DropdownMenu>
        </Dropdown>
    );
};

export default ThemeModeButton;
