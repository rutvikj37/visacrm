import { useEffect, useState } from "react"
import { KeyRound } from "lucide-react"
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, useDisclosure } from "@heroui/react"
import { useNavigate } from "react-router-dom"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import useApiCallUtils from "@/hooks/useApiCallUtils"
import { handleLogout } from "@/utils/LogoutUtils"

const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6)
const empty = { current: "", next: "", confirm: "" }

/**
 * Account menu item: pick a new passcode while signed in (owner or team member).
 * Needs the current passcode; afterwards every device is signed out, so they log in again with the new one.
 * Forgot the current passcode? "Forgot passcode?" on the login page emails a reset code.
 */
const OPEN_EVENT = "open-change-passcode"

/** Account menu item. The menu closes normally (an open menu traps keyboard focus), then the dialog opens. */
const ChangePasscodeItem = () => (
  <DropdownMenuItem onSelect={() => setTimeout(() => window.dispatchEvent(new Event(OPEN_EVENT)), 50)}>
    <KeyRound />
    Change passcode
  </DropdownMenuItem>
)

/** The dialog - mounted once in the panel layout, outside the account menu. */
export const ChangePasscodeDialog = () => {
  const { isOpen, onOpen, onOpenChange } = useDisclosure()
  const { commonPostAPICall } = useApiCallUtils()
  const navigate = useNavigate()
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const ready = form.current.length >= 4 && form.next.length === 6 && form.confirm.length === 6
  const mismatch = form.confirm.length === 6 && form.next !== form.confirm

  const submit = async () => {
    if (!ready || mismatch) return
    setBusy(true)
    setError("")
    const { success, message } = await commonPostAPICall(
      { current_passcode: form.current, passcode: form.next, confirm_passcode: form.confirm },
      "agent/change_passcode",
      true,
    )
    setBusy(false)
    if (success) {
      setForm(empty)
      handleLogout(navigate)
    } else if (message) {
      setError(message)
    }
  }

  useEffect(() => {
    const open = () => {
      setForm(empty); setError(""); onOpen()
      setTimeout(() => document.getElementById("passcode-current")?.focus(), 400)
    }
    window.addEventListener(OPEN_EVENT, open)
    return () => window.removeEventListener(OPEN_EVENT, open)
  }, [onOpen])

  const field = (key: keyof typeof empty, label: string, autoFocus = false) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`passcode-${key}`} className="text-sm font-medium text-foreground">{label}</label>
      <Input
        id={`passcode-${key}`}
        aria-label={label}
        type="password"
        inputMode="numeric"
        autoComplete={key === "current" ? "current-password" : "new-password"}
        placeholder="••••••"
        autoFocus={autoFocus}
        value={form[key]}
        onValueChange={(v) => { setForm((f) => ({ ...f, [key]: digits(v) })); setError("") }}
        classNames={{ input: "tracking-[0.4em]" }}
      />
    </div>
  )

  return (
    <>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="center">
        <ModalContent>
          {(close) => (
            <form onSubmit={(e) => { e.preventDefault(); submit() }}>
              <ModalHeader className="flex flex-col gap-1">
                Change passcode
                <span className="text-sm font-normal text-default-500">
                  Your new passcode is 6 digits. You'll be logged out of every device and sign in again with it.
                </span>
              </ModalHeader>
              <ModalBody className="gap-5">
                {field("current", "Current passcode", true)}
                {field("next", "New passcode (6 digits)")}
                {field("confirm", "Confirm new passcode")}
                {mismatch && <p className="text-sm text-danger">The new passcodes don't match.</p>}
                {error && <p className="text-sm text-danger">{error}</p>}
                <p className="text-xs text-default-500">
                  Forgot your current passcode? Log out and use "Forgot passcode?" on the login page - a reset code is emailed to you.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={close}>Cancel</Button>
                <Button color="primary" type="submit" isLoading={busy} isDisabled={!ready || mismatch}>
                  Change passcode
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>
    </>
  )
}

export default ChangePasscodeItem
