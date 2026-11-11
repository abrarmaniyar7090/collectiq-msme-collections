import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import axios from "axios";

import {
  LogOut,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  IndianRupee,
  Users,
  Clock,
  TrendingUp,
  X,
  MapPin,
  History,
  PlusCircle,
} from "lucide-react";

import api from "../services/api";
import ReminderManager from "./ReminderManager";

import type { AuthUser } from "../types/auth";

import {
  getPendingActivities,
  saveOfflineActivity,
  syncOfflineActivities,
  type OfflineActivityPayload,
} from "../services/offlineQueue";

// --------------------------------------------------
// INTERFACES
// --------------------------------------------------

interface DashboardProps {
  user: AuthUser;
  onLogout: () => void;
}

interface Loan {
  loan_id: string;
  borrower_name: string;
  outstanding_amount: number;
  dpd: number;
  priority_score: number;
  priority_category: string;
  priority_reasons: string[];
}

interface LoanPriorityResponse {
  total_loans: number;
  message: string;
  loans: Loan[];
}

interface ActivityRecord {
  id: number;
  client_event_id: string;
  loan_id: number;
  officer_id: number;
  activity_type: string;
  outcome: string;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  occurred_at: string;
}

interface ActivitySubmissionResponse {
  message?: string;
  blocked?: boolean;
  duplicate?: boolean;
  activity_id?: number;
  loan_id?: string;
  outcome?: string;
}

// --------------------------------------------------
// DATABASE LOAN ID MAPPING
// --------------------------------------------------

const loanDatabaseIds: Record<string, number> = {
  "LN-10293": 1,
  "LN-10871": 2,
  "LN-11930": 3,
  "LN-12045": 4,
  "LN-12046": 5,
};

// --------------------------------------------------
// ERROR MESSAGE HELPER
// --------------------------------------------------

function getErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (axios.isAxiosError<{ detail?: string }>(error)) {
    return (
      error.response?.data?.detail ||
      fallback
    );
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}

// --------------------------------------------------
// DASHBOARD COMPONENT
// --------------------------------------------------

export default function Dashboard({
  user,
  onLogout,
}: DashboardProps) {

  // Loan information
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Selected loan and activity history
  const [selectedLoan, setSelectedLoan] =
    useState<Loan | null>(null);

  const [activities, setActivities] =
    useState<ActivityRecord[]>([]);

  const [historyLoading, setHistoryLoading] =
    useState(false);

  // Collection activity form
  const [activityType, setActivityType] =
    useState<OfflineActivityPayload["activity_type"]>(
      "visit"
    );

  const [outcome, setOutcome] =
    useState<OfflineActivityPayload["outcome"]>(
      "not_reachable"
    );

  const [notes, setNotes] = useState("");

  const [promisedAmount, setPromisedAmount] =
    useState("");

  const [promisedDate, setPromisedDate] =
    useState("");

  // Submission state
  const [submitting, setSubmitting] =
    useState(false);

  const [message, setMessage] = useState("");

  const [messageError, setMessageError] =
    useState(false);

  // GPS state
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const [locationLoading, setLocationLoading] =
    useState(false);

  // Network state
  const [isOnline, setIsOnline] =
    useState(() => navigator.onLine);

  const [pendingSyncCount, setPendingSyncCount] =
    useState(() => getPendingActivities().length);

  // --------------------------------------------------
  // LOAD LOANS
  // --------------------------------------------------

  const fetchLoans = async (): Promise<void> => {
    try {
      setLoading(true);
      setError("");

      const response =
        await api.get<LoanPriorityResponse>(
          "/api/v1/loans/priority"
        );

      setLoans(response.data.loans || []);

    } catch (err: unknown) {
      setError(
        getErrorMessage(
          err,
          "Unable to load loan information."
        )
      );

    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // LOAD ACTIVITY HISTORY
  // --------------------------------------------------

  const fetchActivities = async (
    loan: Loan
  ): Promise<void> => {

    const databaseId =
      loanDatabaseIds[loan.loan_id];

    if (!databaseId) {
      setMessage(
        "Database ID not found for this loan."
      );

      setMessageError(true);
      return;
    }

    try {
      setHistoryLoading(true);
      setActivities([]);

      const response =
        await api.get<ActivityRecord[]>(
          `/api/v1/loans/${databaseId}/activities`
        );

      setActivities(response.data || []);

    } catch (err: unknown) {

      setMessage(
        getErrorMessage(
          err,
          "Unable to load activity history."
        )
      );

      setMessageError(true);

    } finally {
      setHistoryLoading(false);
    }
  };

  // --------------------------------------------------
  // INITIAL LOAN LOAD
  // --------------------------------------------------

  useEffect(() => {

    // Schedule the initial request after the effect
    // completes to avoid synchronous state updates.
    const timer = window.setTimeout(() => {
      void fetchLoans();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };

  }, []);

  // --------------------------------------------------
  // ONLINE / OFFLINE STATUS AND AUTOMATIC SYNC
  // --------------------------------------------------

  useEffect(() => {

    let syncing = false;

    const syncPending = async (): Promise<void> => {

      if (!navigator.onLine || syncing) {
        return;
      }

      syncing = true;

      try {

        console.log(
          "Checking offline activity queue..."
        );

        const syncedCount =
          await syncOfflineActivities();

        const remaining =
          getPendingActivities().length;

        setPendingSyncCount(remaining);

        console.log(
          "Activities synced:",
          syncedCount
        );

        console.log(
          "Activities still pending:",
          remaining
        );

        if (syncedCount > 0) {

          setMessage(
            `${syncedCount} offline activit(ies) synced successfully.`
          );

          setMessageError(false);

          await fetchLoans();

          if (selectedLoan) {
            await fetchActivities(selectedLoan);
          }
        }

      } catch (syncError: unknown) {

        console.error(
          "Offline synchronization error:",
          syncError
        );

      } finally {
        syncing = false;
      }
    };

    // Browser comes online
    const handleOnline = () => {

      console.log(
        "Internet connection restored."
      );

      setIsOnline(true);

      void syncPending();
    };

    // Browser goes offline
    const handleOffline = () => {

      console.log(
        "Internet connection lost."
      );

      setIsOnline(false);
    };

    window.addEventListener(
      "online",
      handleOnline
    );

    window.addEventListener(
      "offline",
      handleOffline
    );

    // State is already initialized from navigator
    // and Local Storage. No synchronous setState here.

    if (navigator.onLine) {
      void syncPending();
    }

    return () => {

      window.removeEventListener(
        "online",
        handleOnline
      );

      window.removeEventListener(
        "offline",
        handleOffline
      );
    };

  }, [selectedLoan]);

  // --------------------------------------------------
  // OPEN ACTIVITY MODAL
  // --------------------------------------------------

  const openActivity = async (
    loan: Loan
  ): Promise<void> => {

    setSelectedLoan(loan);

    setMessage("");
    setMessageError(false);

    setNotes("");
    setPromisedAmount("");
    setPromisedDate("");

    setOutcome("not_reachable");
    setActivityType("visit");

    setLocation(null);

    await fetchActivities(loan);
  };

  // --------------------------------------------------
  // CLOSE ACTIVITY MODAL
  // --------------------------------------------------

  const closeActivity = (): void => {

    if (submitting) {
      return;
    }

    setSelectedLoan(null);
    setActivities([]);

    setMessage("");
    setMessageError(false);

    setNotes("");
    setPromisedAmount("");
    setPromisedDate("");

    setLocation(null);
  };

  // --------------------------------------------------
  // CAPTURE GPS LOCATION
  // --------------------------------------------------

  const captureLocation = (): void => {

    if (!navigator.geolocation) {

      setMessage(
        "Geolocation is not supported by this browser."
      );

      setMessageError(true);
      return;
    }

    setLocationLoading(true);
    setMessage("");

    navigator.geolocation.getCurrentPosition(

      (position) => {

        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });

        setLocationLoading(false);

        setMessage(
          "GPS location captured successfully."
        );

        setMessageError(false);
      },

      () => {

        setLocationLoading(false);

        setMessage(
          "Location permission denied. Please allow location access in your browser."
        );

        setMessageError(true);
      },

      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  };

  // --------------------------------------------------
  // SUBMIT COLLECTION ACTIVITY
  // --------------------------------------------------

  const submitActivity = async (): Promise<void> => {

    console.log(
      "SUBMIT BUTTON CLICKED"
    );

    const browserOnline = navigator.onLine;

    console.log(
      "Browser online status:",
      browserOnline
    );

    setIsOnline(browserOnline);

    if (!selectedLoan) {
      return;
    }

    // Validate notes
    if (!notes.trim()) {

      setMessage(
        "Please enter activity notes."
      );

      setMessageError(true);
      return;
    }

    // Validate GPS
    if (!location) {

      setMessage(
        "Please capture GPS location before submitting."
      );

      setMessageError(true);
      return;
    }

    // Validate promise details
    if (outcome === "promise") {

      if (
        !promisedAmount ||
        Number(promisedAmount) <= 0
      ) {

        setMessage(
          "Enter a valid promised amount."
        );

        setMessageError(true);
        return;
      }

      if (!promisedDate) {

        setMessage(
          "Please select the promised payment date."
        );

        setMessageError(true);
        return;
      }

      // Validate YYYY-MM-DD
      const datePattern =
        /^\d{4}-\d{2}-\d{2}$/;

      if (!datePattern.test(promisedDate)) {

        setMessage(
          "Invalid promised payment date."
        );

        setMessageError(true);
        return;
      }

      const [year, month, day] =
        promisedDate.split("-").map(Number);

      const selectedDate = new Date(
        year,
        month - 1,
        day
      );

      if (
        selectedDate.getFullYear() !== year ||
        selectedDate.getMonth() !== month - 1 ||
        selectedDate.getDate() !== day
      ) {

        setMessage(
          "Please select a valid calendar date."
        );

        setMessageError(true);
        return;
      }
    }

    // Find database ID
    const databaseId =
      loanDatabaseIds[selectedLoan.loan_id];

    if (!databaseId) {

      setMessage(
        "Loan database ID not found."
      );

      setMessageError(true);
      return;
    }

    // Create strongly typed activity payload
    const payload: OfflineActivityPayload = {

      client_event_id:
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `collectiq-${Date.now()}-${Math.random()
              .toString(16)
              .slice(2)}`,

      activity_type: activityType,

      outcome,

      notes: notes.trim(),

      latitude: location.latitude,

      longitude: location.longitude,

      occurred_at: new Date().toISOString(),
    };

    // Add promise information
    if (outcome === "promise") {

      payload.promised_amount =
        Number(promisedAmount);

      // Keep the exact YYYY-MM-DD format.
      // Do not convert this value to a Date.
      payload.promised_date = promisedDate;
    }

    console.log(
      "PROMISED DATE SELECTED:",
      promisedDate
    );

    console.log(
      "FINAL ACTIVITY PAYLOAD:",
      payload
    );

    setSubmitting(true);
    setMessage("");

    try {

      // ----------------------------------------------
      // OFFLINE SUBMISSION
      // ----------------------------------------------

      if (!browserOnline) {

        console.log(
          "OFFLINE BRANCH EXECUTED"
        );

        saveOfflineActivity({
          loanDatabaseId: databaseId,
          payload,
        });

        const pending =
          getPendingActivities();

        console.log(
          "SAVED OFFLINE ACTIVITIES:",
          pending
        );

        const saved = pending.some(
          (item) =>
            item.payload.client_event_id ===
            payload.client_event_id
        );

        if (!saved) {

          throw new Error(
            "Activity could not be saved to local storage."
          );
        }

        setPendingSyncCount(
          pending.length
        );

        setMessage(
          "Offline: Activity saved on this device. It will sync automatically when internet returns."
        );

        setMessageError(false);

      } else {

        // --------------------------------------------
        // ONLINE SUBMISSION
        // --------------------------------------------

        console.log(
          "ONLINE BRANCH EXECUTED"
        );

        try {

          const response =
            await api.post<ActivitySubmissionResponse>(
              `/api/v1/loans/${databaseId}/activities`,
              payload
            );

          console.log(
            "ACTIVITY API RESPONSE:",
            response.data
          );

          if (response.data.blocked) {

            setMessage(
              response.data.message ||
                "Contact attempt blocked by permitted contact hours. The attempt has been logged."
            );

            setMessageError(true);

          } else {

            setMessage(
              response.data.message ||
                "Collection activity recorded successfully."
            );

            setMessageError(false);
          }

          await fetchActivities(selectedLoan);

          await fetchLoans();

        } catch (requestError: unknown) {

          // If the network connection disappears during
          // submission, save the activity locally.
          if (
            axios.isAxiosError(requestError) &&
            !requestError.response
          ) {

            console.log(
              "Connection lost. Saving activity locally."
            );

            saveOfflineActivity({
              loanDatabaseId: databaseId,
              payload,
            });

            const pending =
              getPendingActivities();

            setPendingSyncCount(
              pending.length
            );

            setMessage(
              "Connection lost. Activity saved locally and will sync when internet returns."
            );

            setMessageError(false);

          } else {

            throw requestError;
          }
        }
      }

      // Clear form fields after successful handling
      setNotes("");
      setPromisedAmount("");
      setPromisedDate("");

    } catch (err: unknown) {

      console.error(
        "ACTIVITY SUBMISSION ERROR:",
        err
      );

      setMessage(
        getErrorMessage(
          err,
          "Unable to record activity. Please try again."
        )
      );

      setMessageError(true);

    } finally {

      setSubmitting(false);
    }
  };

  // --------------------------------------------------
  // DASHBOARD CALCULATIONS
  // --------------------------------------------------

  const totalOutstanding = loans.reduce(
    (total, loan) =>
      total + loan.outstanding_amount,
    0
  );

  const highPriority = loans.filter(
    (loan) =>
      loan.priority_category === "High"
  ).length;

  const overdueLoans = loans.filter(
    (loan) => loan.dpd > 0
  ).length;

  // --------------------------------------------------
  // FORMAT CURRENCY
  // --------------------------------------------------

  const formatCurrency = (
    amount: number
  ): string => {

    return new Intl.NumberFormat(
      "en-IN",
      {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }
    ).format(amount);
  };

  // --------------------------------------------------
  // PRIORITY CATEGORY STYLE
  // --------------------------------------------------

  const priorityStyle = (
    category: string
  ): string => {

    if (category === "High") {
      return "bg-red-100 text-red-700";
    }

    if (category === "Medium") {
      return "bg-amber-100 text-amber-700";
    }

    return "bg-green-100 text-green-700";
  };

  // --------------------------------------------------
  // DASHBOARD UI
  // --------------------------------------------------

  return (
    <div className="min-h-screen bg-slate-100">

      {/* Header */}
      <header className="bg-white border-b px-6 py-4">

        <div className="max-w-7xl mx-auto flex justify-between items-center">

          <div className="flex items-center gap-3">

            <div className="bg-blue-600 p-2 rounded-lg">

              <ShieldCheck
                className="text-white"
                size={25}
              />

            </div>

            <div>

              <h1 className="text-xl font-bold text-slate-900">
                CollectIQ
              </h1>

              <p className="text-xs text-slate-500">
                Field Collections Platform
              </p>

            </div>

          </div>

          <div className="flex items-center gap-4">

            <div className="text-right hidden sm:block">

              <p className="font-semibold text-slate-800">
                {user.full_name}
              </p>

              <p className="text-xs text-slate-500">
                Field Officer
              </p>

            </div>

            <button
              onClick={onLogout}
              className="flex items-center gap-2 border rounded-lg px-3 py-2 hover:bg-slate-100"
            >
              <LogOut size={17} />
              Logout
            </button>

          </div>

        </div>

      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* Network Status */}
        <div className="mb-6 flex flex-wrap items-center gap-3">

          <div
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              isOnline
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >

            {isOnline
              ? "● Online"
              : "● Offline"}

          </div>

          {pendingSyncCount > 0 && (

            <div className="rounded-lg bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-800">

              {pendingSyncCount}{" "}

              {pendingSyncCount === 1
                ? "activity"
                : "activities"}{" "}

              waiting to sync

            </div>

          )}

        </div>

        {/* Welcome */}
        <div className="mb-8">

          <h2 className="text-2xl font-bold text-slate-900">
            Welcome, {user.full_name}
          </h2>

          <p className="text-slate-500 mt-1">
            Here's your collection activity overview for today.
          </p>

        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">

          <SummaryCard
            title="Assigned Loans"
            value={loans.length.toString()}
            icon={<Users size={22} />}
          />

          <SummaryCard
            title="Total Outstanding"
            value={formatCurrency(totalOutstanding)}
            icon={<IndianRupee size={22} />}
          />

          <SummaryCard
            title="High Priority Loans"
            value={highPriority.toString()}
            icon={<TrendingUp size={22} />}
          />

          <SummaryCard
            title="Overdue Loans"
            value={overdueLoans.toString()}
            icon={<Clock size={22} />}
          />

        </div>

        {/* Loan Priority Section */}
        <div className="bg-white rounded-xl shadow-sm border">

          <div className="flex justify-between items-center p-6 border-b">

            <div>

              <h3 className="text-lg font-bold text-slate-900">
                AI Loan Priorities
              </h3>

              <p className="text-sm text-slate-500 mt-1">
                Loans ranked using explainable AI scoring.
              </p>

            </div>

            <button
              onClick={() => void fetchLoans()}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >

              <RefreshCw size={16} />

              Refresh

            </button>

          </div>

          <div className="p-6">

            {loading && (

              <p className="text-center py-10 text-slate-500">
                Loading loan priorities...
              </p>

            )}

            {error && (

              <div className="flex items-center gap-3 bg-red-50 text-red-700 p-4 rounded-lg">

                <AlertCircle size={20} />

                {error}

              </div>

            )}

            {!loading &&
              !error &&
              loans.length === 0 && (

                <p className="text-center py-10 text-slate-500">
                  No assigned loans found.
                </p>

              )}

            {!loading &&
              !error &&
              loans.length > 0 && (

                <div className="space-y-4">

                  {loans.map((loan) => (

                    <div
                      key={loan.loan_id}
                      className="border rounded-xl p-5 hover:shadow-md transition"
                    >

                      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">

                        <div>

                          <p className="text-sm text-slate-500">
                            {loan.loan_id}
                          </p>

                          <h4 className="text-lg font-bold text-slate-900 mt-1">
                            {loan.borrower_name}
                          </h4>

                          <p className="text-sm text-slate-600 mt-2">

                            Outstanding:{" "}

                            <span className="font-semibold">
                              {formatCurrency(
                                loan.outstanding_amount
                              )}
                            </span>

                          </p>

                          <p className="text-sm text-slate-600">

                            Days Past Due:{" "}

                            <span className="font-semibold">
                              {loan.dpd} days
                            </span>

                          </p>

                        </div>

                        <div className="flex items-center gap-4">

                          <div className="text-center">

                            <p className="text-xs text-slate-500">
                              AI Score
                            </p>

                            <p className="text-2xl font-bold text-blue-600">
                              {loan.priority_score}
                            </p>

                          </div>

                          <span
                            className={`px-3 py-1 rounded-full text-sm font-semibold ${priorityStyle(
                              loan.priority_category
                            )}`}
                          >
                            {loan.priority_category}
                          </span>

                        </div>

                      </div>

                      <div className="mt-4 bg-slate-50 rounded-lg p-4">

                        <p className="text-sm font-semibold text-slate-700 mb-2">
                          Why this loan is prioritised
                        </p>

                        <ul className="space-y-1">

                          {loan.priority_reasons.map(
                            (reason, index) => (

                              <li
                                key={index}
                                className="text-sm text-slate-600"
                              >
                                • {reason}
                              </li>

                            )
                          )}

                        </ul>

                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">

                        <button
                          onClick={() =>
                            void openActivity(loan)
                          }
                          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                        >

                          <PlusCircle size={17} />

                          Record Activity

                        </button>

                      </div>

                    </div>

                  ))}

                </div>

              )}

          </div>

        </div>

        {/* AI Reminder Generator */}
        <ReminderManager
          loans={loans.map((loan) => ({
            databaseId: loanDatabaseIds[loan.loan_id],
            loanId: loan.loan_id,
            borrowerName: loan.borrower_name,
          }))}
        />

      </main>

      {/* Collection Activity Modal */}
      {selectedLoan &&

        createPortal(

          <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/60 p-3 sm:p-5">

            <div
              className="relative mx-auto my-2 flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
              style={{
                height: "calc(100dvh - 24px)",
              }}
            >

              {/* Fixed Header */}
              <div className="flex shrink-0 items-center justify-between border-b bg-white px-5 py-4">

                <div>

                  <h2 className="text-xl font-bold text-slate-900">
                    Collection Activity
                  </h2>

                  <p className="text-sm text-slate-500 mt-1">
                    {selectedLoan.loan_id} ·{" "}
                    {selectedLoan.borrower_name}
                  </p>

                </div>

                <button
                  type="button"
                  onClick={closeActivity}
                  disabled={submitting}
                  className="flex h-11 w-11 items-center justify-center rounded-lg border bg-white text-slate-700 hover:bg-slate-100"
                  aria-label="Close activity"
                >

                  <X size={24} />

                </button>

              </div>

              {/* Scrollable Content */}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">

                {message && (

                  <div
                    className={`mb-5 rounded-lg p-3 text-sm ${
                      messageError
                        ? "bg-amber-50 text-amber-800"
                        : "bg-green-50 text-green-800"
                    }`}
                  >
                    {message}
                  </div>

                )}

                {/* Activity Form */}
                <h3 className="mb-4 font-bold text-slate-800">
                  Record New Activity
                </h3>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                  <div>

                    <label className="mb-2 block text-sm font-medium">
                      Activity Type
                    </label>

                    <select
                      value={activityType}
                      onChange={(e) =>
                        setActivityType(
                          e.target.value as OfflineActivityPayload["activity_type"]
                        )
                      }
                      className="w-full rounded-lg border p-3"
                    >

                      <option value="call">
                        Call
                      </option>

                      <option value="visit">
                        Visit
                      </option>

                    </select>

                  </div>

                  <div>

                    <label className="mb-2 block text-sm font-medium">
                      Outcome
                    </label>

                    <select
                      value={outcome}
                      onChange={(e) =>
                        setOutcome(
                          e.target.value as OfflineActivityPayload["outcome"]
                        )
                      }
                      className="w-full rounded-lg border p-3"
                    >

                      <option value="paid">
                        Payment Received
                      </option>

                      <option value="promise">
                        Promise to Pay
                      </option>

                      <option value="not_reachable">
                        Not Reachable
                      </option>

                      <option value="dispute">
                        Dispute
                      </option>

                    </select>

                  </div>

                </div>

                {/* Promise Details */}
                {outcome === "promise" && (

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">

                    <div>

                      <label className="mb-2 block text-sm font-medium">
                        Promised Amount (₹)
                      </label>

                      <input
                        type="number"
                        min="1"
                        value={promisedAmount}
                        onChange={(e) =>
                          setPromisedAmount(e.target.value)
                        }
                        placeholder="Enter amount"
                        className="w-full rounded-lg border p-3"
                      />

                    </div>

                    <div>

                      <label className="mb-2 block text-sm font-medium">
                        Promised Payment Date
                      </label>

                      <input
                        type="date"
                        value={promisedDate}
                        onChange={(e) =>
                          setPromisedDate(e.target.value)
                        }
                        className="w-full rounded-lg border p-3"
                      />

                    </div>

                  </div>

                )}

                {/* Activity Notes */}
                <div className="mt-4">

                  <label className="mb-2 block text-sm font-medium">
                    Activity Notes
                  </label>

                  <textarea
                    value={notes}
                    onChange={(e) =>
                      setNotes(e.target.value)
                    }
                    placeholder="Describe the customer interaction..."
                    rows={3}
                    className="w-full resize-none rounded-lg border p-3"
                  />

                </div>

                {/* GPS */}
                <div className="mt-4 rounded-lg border p-4">

                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">

                    <div className="flex items-center gap-2">

                      <MapPin
                        className="text-blue-600"
                        size={20}
                      />

                      <div>

                        <p className="text-sm font-semibold">
                          GPS Location
                        </p>

                        <p className="text-xs text-slate-500">

                          {location
                            ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
                            : "Location not captured"}

                        </p>

                      </div>

                    </div>

                    <button
                      type="button"
                      onClick={captureLocation}
                      disabled={locationLoading}
                      className="rounded-lg bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                    >

                      {locationLoading
                        ? "Capturing..."
                        : location
                        ? "Refresh Location"
                        : "Capture GPS"}

                    </button>

                  </div>

                </div>

                {/* Submit Activity */}
                <button
                  type="button"
                  onClick={() => void submitActivity()}
                  disabled={
                    submitting || locationLoading
                  }
                  className="mt-5 w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >

                  {submitting
                    ? "Saving Activity..."
                    : "Submit Collection Activity"}

                </button>

                {/* Activity History */}
                <div className="mt-6 border-t pt-5">

                  <div className="mb-4 flex items-center gap-2">

                    <History
                      className="text-blue-600"
                      size={20}
                    />

                    <h3 className="font-bold text-slate-800">
                      Activity History
                    </h3>

                  </div>

                  {historyLoading && (

                    <p className="py-4 text-sm text-slate-500">
                      Loading activity history...
                    </p>

                  )}

                  {!historyLoading &&
                    activities.length === 0 && (

                      <p className="py-4 text-sm text-slate-500">
                        No activities recorded for this loan yet.
                      </p>

                    )}

                  {!historyLoading &&
                    activities.length > 0 && (

                      <div className="space-y-3">

                        {activities.map((activity) => (

                          <div
                            key={activity.id}
                            className="rounded-lg border p-4"
                          >

                            <div className="flex items-start justify-between gap-3">

                              <div>

                                <p className="font-semibold capitalize text-slate-800">
                                  {activity.outcome
                                    .split("_")
                                    .join(" ")}
                                </p>

                                <p className="mt-1 text-xs capitalize text-slate-500">
                                  Activity:{" "}
                                  {activity.activity_type}
                                </p>

                              </div>

                              <span className="text-right text-xs text-slate-500">

                                {new Date(
                                  activity.occurred_at
                                ).toLocaleString("en-IN")}

                              </span>

                            </div>

                            <p className="mt-3 text-sm text-slate-600">
                              {activity.notes}
                            </p>

                            {activity.latitude !== null &&
                              activity.longitude !== null && (

                                <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">

                                  <MapPin size={13} />

                                  {activity.latitude},{" "}

                                  {activity.longitude}

                                </p>

                              )}

                          </div>

                        ))}

                      </div>

                    )}

                </div>

              </div>

              {/* Fixed Footer */}
              <div className="flex shrink-0 justify-end border-t bg-white px-5 py-3">

                <button
                  type="button"
                  onClick={closeActivity}
                  disabled={submitting}
                  className="rounded-lg border px-6 py-2 font-medium text-slate-700 hover:bg-slate-100"
                >
                  Close
                </button>

              </div>

            </div>

          </div>,

          document.body
        )}

    </div>
  );
}

// --------------------------------------------------
// SUMMARY CARD COMPONENT
// --------------------------------------------------

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: ReactNode;
}) {

  return (

    <div className="bg-white p-5 rounded-xl shadow-sm border">

      <div className="flex justify-between items-center">

        <div>

          <p className="text-sm text-slate-500">
            {title}
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-2">
            {value}
          </h3>

        </div>

        <div className="bg-blue-50 text-blue-600 p-3 rounded-lg">
          {icon}
        </div>

      </div>

    </div>

  );
}