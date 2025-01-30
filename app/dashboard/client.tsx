"use client"

import { useState, useEffect } from "react"
import useSWR, { mutate } from "swr"
import { getAuth, type User } from "firebase/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Key, Trash2, AlertCircle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

const fetcher = async (url: string) => {
  const auth = getAuth()
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || "An error occurred while fetching the data.")
  }
  return res.json()
}

interface Transaction {
  _id: string
  type: string
  amount: number
  description: string
  timestamp: string
  userId: string
}

interface Wallet {
  balance: number
}

interface ApiKey {
  _id: string
  key: string
  createdAt: string
}

interface DashboardClientProps {
  initialWallet: Wallet | null
  initialTransactions: Transaction[]
  initialTotalCount: number
}


export default function DashboardClient({
  initialWallet,
  initialTransactions = [], // Add default value
  initialTotalCount = 0,   // Add default value
}: DashboardClientProps) {
  const [user, setUser] = useState<User | null>(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const auth = getAuth()
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user)
    })

    return () => unsubscribe()
  }, [])

  const { data: wallet, error: walletError } = useSWR<Wallet>(
    user ? "/api/wallet" : null,
    fetcher,
    {
      fallbackData: initialWallet,
      revalidateOnFocus: false
    }
  )

  const { data: apiKeysData = [], error: apiKeysError } = useSWR<ApiKey[]>( // Add default empty array
    user ? "/api/api-keys" : null,
    fetcher,
    {
      revalidateOnFocus: false
    }
  )

  const { data: transactionsData, error: transactionsError } = useSWR<{
    transactions: Transaction[]
    totalCount: number
    page: number
    limit: number
  }>(
    user ? `/api/transactions?page=${page}&limit=10` : null,
    fetcher,
    {
      fallbackData: { 
        transactions: initialTransactions, 
        totalCount: initialTotalCount,
        page: 1,
        limit: 10
      },
      keepPreviousData: true,
      revalidateOnFocus: false
    }
  )

  const generateApiKey = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const auth = getAuth()
      const token = await auth.currentUser?.getIdToken()
      const response = await fetch("/api/generate-key", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate API key")
      }
      await mutate("/api/api-keys")
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }

  const deleteApiKey = async (key: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const auth = getAuth()
      const token = await auth.currentUser?.getIdToken()
      const response = await fetch(`/api/api-key/${key}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to delete API key")
      }
      await mutate("/api/api-keys")
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }


  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please sign in to view the dashboard.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (walletError || apiKeysError || transactionsError) {
    const errorMessage = walletError?.message || apiKeysError?.message || transactionsError?.message
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Error loading dashboard data: {errorMessage}
        </AlertDescription>
      </Alert>
    )
  }

  // Safely calculate total pages
  const totalPages = transactionsData ? Math.ceil((transactionsData.totalCount || 0) / 10) : 0

  return (
    <div className="space-y-8">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Wallet Section */}
      {wallet ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl text-indigo-600">Wallet Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${wallet.balance.toFixed(3)}</p>
          </CardContent>
        </Card>
      ) : (
        <Skeleton className="w-full h-32" />
      )}

      {/* API Key Management Section */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-center text-gray-900">API Key Management</h2>
        <div className="flex justify-center">
          <Button
            onClick={generateApiKey}
            disabled={isLoading || (Array.isArray(apiKeysData) && apiKeysData.length >= 2)} // Add Array.isArray check
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Key className="mr-2 h-4 w-4" />
            {isLoading ? "Generating..." : "Generate New API Key"}
          </Button>
        </div>

        {Array.isArray(apiKeysData) ? ( // Add Array.isArray check
          <div className="grid gap-6">
            {apiKeysData.map((key) => (
              <Card key={key._id}>
                <CardHeader>
                  <CardTitle className="text-xl text-indigo-600">API Key</CardTitle>
                  <CardDescription>Created on: {new Date(key.createdAt).toLocaleString()}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="font-mono bg-gray-100 p-3 rounded text-sm break-all">{key.key}</p>
                </CardContent>
                <CardFooter>
                  <Button 
                    variant="destructive" 
                    onClick={() => deleteApiKey(key.key)}
                    disabled={isLoading}
                    className="w-full"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {isLoading ? "Deleting..." : "Delete"}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-6">
            {[...Array(2)].map((_, index) => (
              <Skeleton key={index} className="w-full h-40" />
            ))}
          </div>
        )}

        {Array.isArray(apiKeysData) && apiKeysData.length === 0 && (
          <p className="text-center text-gray-600">
            You haven't generated any API keys yet. Generate one to get started!
          </p>
        )}
      </div>

      {/* Transactions Section */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-center text-gray-900">Credit Transaction History</h2>
        
        {transactionsData && Array.isArray(transactionsData.transactions) ? (
          <>
            {transactionsData.transactions.length > 0 ? (
              <div className="grid gap-4">
                {transactionsData.transactions.map((transaction) => (
                  <Card key={transaction._id}>
                    <CardHeader>
                      <CardTitle className="text-lg text-indigo-600">
                        {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                      </CardTitle>
                      <CardDescription>{new Date(transaction.timestamp).toLocaleString()}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="font-bold">${transaction.amount.toFixed(2)}</p>
                      <p className="text-gray-600">{transaction.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-600">
                No transactions found. Transactions will appear here when you make your first API call.
              </p>
            )}

            {transactionsData.transactions.length > 0 && (
              <div className="flex items-center justify-between">
                <Button 
                  onClick={() => setPage(page > 1 ? page - 1 : 1)} 
                  disabled={page === 1}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <Button 
                  onClick={() => setPage(page + 1)} 
                  disabled={page >= totalPages}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  Next
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="grid gap-4">
            {[...Array(3)].map((_, index) => (
              <Skeleton key={index} className="w-full h-32" />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}