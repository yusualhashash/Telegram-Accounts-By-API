"use client"

import type { Account } from "../lib/types"

interface AccountSelectorProps {
  isOpen: boolean
  onClose: () => void
  accounts: Account[]
  selectedAccount: Account | null
  onSelectAccount: (account: Account) => void
  onAddAccount: (type: "telegram" | "whatsapp") => void
}

export default function AccountSelector({
  isOpen,
  onClose,
  accounts,
  selectedAccount,
  onSelectAccount,
  onAddAccount,
}: AccountSelectorProps) {
  if (!isOpen) return null

  const handleSelectAccount = (account: Account) => {
    // Only call onSelectAccount if selecting a different account
    if (selectedAccount?.phone !== account.phone) {
      onSelectAccount(account)
    } else {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#17212b] rounded-lg p-4 w-full max-w-xs">
        <h3 className="text-white font-medium mb-3">Select Account</h3>

        <div className="max-h-60 overflow-y-auto">
          {accounts.length === 0 ? (
            <div className="p-3 text-[#8e9ba8] text-center">
              No accounts found. Add a Telegram account to get started.
            </div>
          ) : (
            accounts.map((account) => (
              <div
                key={account.phone}
                className={`p-3 rounded cursor-pointer mb-1 ${
                  selectedAccount?.phone === account.phone ? "bg-[#2b5278]" : "hover:bg-[#242f3d]"
                }`}
                onClick={() => handleSelectAccount(account)}
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-[#5288c1] flex items-center justify-center text-white">
                    {account.phone.substring(0, 2)}
                  </div>
                  <span className="ml-3 text-white">{account.phone}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-[#242f3d] flex justify-between">
          <button onClick={() => onAddAccount("telegram")} className="text-[#5288c1] hover:text-white">
            Add Account
          </button>
          <button onClick={onClose} className="text-[#8e9ba8] hover:text-white">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

