import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import axios from "axios";

import {
  ShieldCheck,
  LogOut,
  RefreshCw,
  Users,
  IndianRupee,
  Clock,
  TrendingUp,
  Activity,
  CheckCircle,
  AlertTriangle,
  Target,
  CalendarDays,
  XCircle,
} from "lucide-react";

import api from "../services/api";
import type { AuthUser } from "../types/auth";

// ---------------------------------------------------------
// TYPES
// ---------------------------------------------------------

interface ManagerData {
  message: string;
  branch: string;

  loan_overview: {
    total_loans: number;
    total_outstanding_amount: number;

    dpd_distribution: {
      current: number;
      "1_30_dpd": number;
      "31_60_dpd": number;
      "61_plus_dpd": number;
    };
  };

  promise_overview: {
    total: number;
    pending: number;
    overdue: number;
    fulfilled: number;
    broken: number;
  };

  collection_activity_overview: {
    total: number;
    paid: number;
    promise: number;
    not_reachable: number;
    dispute: number;
    contact_blocked: number;
    other: number;
  };

  roll_rate_tracking: {
    current_1_30_dpd_loans: number;
    current_31_60_dpd_loans: number;
    historical_roll_rate_available: boolean;
    baseline_roll_rate_percent: number;
    target_roll_rate_percent: number;
    note: string;
  };
}

interface OfficerPerformance {
  officer_id: number;
  officer_name: string;
  branch: string;
  assigned_loans: number;
  total_outstanding_amount: number;
  overdue_loans: number;
  collection_activities: number;
  payments_received: number;
  promises_obtained: number;
}

interface OfficerPerformanceData {
  message: string;
  branch: string;
  total_officers: number;
  officers: OfficerPerformance[];
}

interface PromiseRecord {
  promise_id: number;
  loan_id: string;
  borrower_name: string;
  promised_amount: number;
  promised_date: string;
  status: string;
  original_status: string;
  reminder_sent: boolean;
  officer_name: string;
  outstanding_amount: number;
  dpd: number;
  created_at: string | null;
}

interface PromiseResponse {
  total_promises: number;
  promises: PromiseRecord[];
}

interface PromiseStatusResponse {
  message?: string;
}

interface Props {
  user: AuthUser;
  onLogout: () => void;
}

// ---------------------------------------------------------
// ERROR HANDLING
// ---------------------------------------------------------

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

// ---------------------------------------------------------
// MANAGER DASHBOARD
// ---------------------------------------------------------

export default function ManagerDashboard({
  user,
  onLogout,
}: Props) {

  // Dashboard state
  const [data, setData] =
    useState<ManagerData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  // Officer performance state
  const [officerData, setOfficerData] =
    useState<OfficerPerformanceData | null>(null);

  const [officerLoading, setOfficerLoading] =
    useState(true);

  const [officerError, setOfficerError] =
    useState("");

  // Promise management state
  const [promiseData, setPromiseData] =
    useState<PromiseResponse | null>(null);

  const [promiseLoading, setPromiseLoading] =
    useState(true);

  const [promiseError, setPromiseError] =
    useState("");

  const [promiseMessage, setPromiseMessage] =
    useState("");

  const [updatingPromise, setUpdatingPromise] =
    useState<number | null>(null);

  // -------------------------------------------------------
  // FETCH MANAGER DASHBOARD
  // -------------------------------------------------------

  const fetchDashboard = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError("");

      const response =
        await api.get<ManagerData>(
          "/api/v1/dashboard/manager"
        );

      setData(response.data);

    } catch (err: unknown) {

      setError(
        getErrorMessage(
          err,
          "Unable to load manager dashboard."
        )
      );

    } finally {
      setLoading(false);
    }
  }, []);

  // -------------------------------------------------------
  // FETCH OFFICER PERFORMANCE
  // -------------------------------------------------------

  const fetchOfficerPerformance =
    useCallback(async (): Promise<void> => {

      try {
        setOfficerLoading(true);
        setOfficerError("");

        const response =
          await api.get<OfficerPerformanceData>(
            "/api/v1/dashboard/manager/officer-performance"
          );

        setOfficerData(response.data);

      } catch (err: unknown) {

        setOfficerError(
          getErrorMessage(
            err,
            "Unable to load officer performance."
          )
        );

      } finally {
        setOfficerLoading(false);
      }

    }, []);

  // -------------------------------------------------------
  // FETCH PROMISES
  // -------------------------------------------------------

  const fetchPromises = useCallback(
    async (): Promise<void> => {

      try {
        setPromiseLoading(true);
        setPromiseError("");

        const response =
          await api.get<PromiseResponse>(
            "/api/v1/promises"
          );

        setPromiseData(response.data);

      } catch (err: unknown) {

        setPromiseError(
          getErrorMessage(
            err,
            "Unable to load payment promises."
          )
        );

      } finally {
        setPromiseLoading(false);
      }

    },
    []
  );

  // -------------------------------------------------------
  // UPDATE PROMISE STATUS
  // -------------------------------------------------------

  const updatePromiseStatus = async (
    promiseId: number,
    status: "fulfilled" | "broken"
  ): Promise<void> => {

    const confirmation =
      status === "fulfilled"
        ? "Mark this payment promise as fulfilled?"
        : "Mark this payment promise as broken?";

    if (!window.confirm(confirmation)) {
      return;
    }

    try {
      setUpdatingPromise(promiseId);
      setPromiseError("");
      setPromiseMessage("");

      const response =
        await api.patch<PromiseStatusResponse>(
          `/api/v1/promises/${promiseId}/status`,
          { status }
        );

      setPromiseMessage(
        response.data.message ||
          "Promise status updated successfully."
      );

      await Promise.all([
        fetchPromises(),
        fetchDashboard(),
        fetchOfficerPerformance(),
      ]);

    } catch (err: unknown) {

      setPromiseError(
        getErrorMessage(
          err,
          "Unable to update promise status."
        )
      );

    } finally {
      setUpdatingPromise(null);
    }
  };

  // -------------------------------------------------------
  // REFRESH ALL SECTIONS
  // -------------------------------------------------------

  const refreshAll = useCallback((): void => {

    void fetchDashboard();
    void fetchOfficerPerformance();
    void fetchPromises();

  }, [
    fetchDashboard,
    fetchOfficerPerformance,
    fetchPromises,
  ]);

  // -------------------------------------------------------
  // INITIAL DASHBOARD LOAD
  // -------------------------------------------------------

  useEffect(() => {

    // Defer loading until after the current effect completes.
    const timer = window.setTimeout(() => {
      refreshAll();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };

  }, [refreshAll]);

  // -------------------------------------------------------
  // FORMATTING
  // -------------------------------------------------------

  const currency = (amount: number): string => {

    return new Intl.NumberFormat(
      "en-IN",
      {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }
    ).format(amount);
  };

  // -------------------------------------------------------
  // FORMAT DATE
  // -------------------------------------------------------

  const formatDate = (value: string): string => {

    if (!value) {
      return "Date unavailable";
    }

    // Parse calendar date without UTC timezone conversion.
    const datePart = value.slice(0, 10);

    const [year, month, day] =
      datePart.split("-").map(Number);

    const date = new Date(
      year,
      month - 1,
      day
    );

    return date.toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };

  // -------------------------------------------------------
  // PROMISE STATUS STYLE
  // -------------------------------------------------------

  const getStatusStyle = (status: string): string => {

    switch (status.toLowerCase()) {

      case "fulfilled":
        return "bg-green-100 text-green-700";

      case "broken":
        return "bg-red-100 text-red-700";

      case "overdue":
        return "bg-orange-100 text-orange-700";

      default:
        return "bg-blue-100 text-blue-700";
    }
  };

  // -------------------------------------------------------
  // UI
  // -------------------------------------------------------

  return (

    <div className="min-h-screen bg-slate-100">

      {/* HEADER */}

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
                Branch Collections Management
              </p>

            </div>

          </div>

          <div className="flex items-center gap-4">

            <div className="text-right hidden sm:block">

              <p className="font-semibold text-slate-800">
                {user.full_name}
              </p>

              <p className="text-xs text-blue-600">
                Branch Manager
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

        {/* WELCOME */}

        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-8">

          <div>

            <h2 className="text-2xl font-bold text-slate-900">
              Welcome, {user.full_name}
            </h2>

            <p className="text-slate-500 mt-1">
              Branch collection performance and monitoring.
            </p>

            <p className="text-sm text-blue-600 mt-1">
              Branch: {data?.branch || "Loading..."}
            </p>

          </div>

          <button
            onClick={refreshAll}
            disabled={
              loading ||
              officerLoading ||
              promiseLoading
            }
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >

            <RefreshCw size={17} />

            Refresh Dashboard

          </button>

        </div>

        {/* LOADING */}

        {loading && (

          <div className="bg-white rounded-xl p-10 text-center text-slate-500">

            Loading manager dashboard...

          </div>

        )}

        {/* ERROR */}

        {error && (

          <div className="bg-red-50 text-red-700 p-4 rounded-xl mb-6">
            {error}
          </div>

        )}

        {/* DASHBOARD */}

        {data && !loading && (

          <>

            {/* SUMMARY CARDS */}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">

              <SummaryCard
                title="Total Loans"
                value={data.loan_overview.total_loans.toString()}
                icon={<Users size={23} />}
              />

              <SummaryCard
                title="Total Outstanding"
                value={currency(
                  data.loan_overview.total_outstanding_amount
                )}
                icon={<IndianRupee size={23} />}
              />

              <SummaryCard
                title="Pending Promises"
                value={data.promise_overview.pending.toString()}
                icon={<Clock size={23} />}
              />

              <SummaryCard
                title="Collection Activities"
                value={data.collection_activity_overview.total.toString()}
                icon={<Activity size={23} />}
              />

            </div>

            {/* FIELD OFFICER PERFORMANCE */}

            <Section title="Field Officer Performance">

              {officerLoading && (

                <p className="text-slate-500 text-sm">
                  Loading officer performance...
                </p>

              )}

              {officerError && (

                <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">
                  {officerError}
                </div>

              )}

              {officerData && !officerLoading && (

                <>

                  <div className="flex items-center justify-between mb-5">

                    <div>

                      <p className="text-sm text-slate-500">
                        Active field officers
                      </p>

                      <p className="text-2xl font-bold text-slate-900">
                        {officerData.total_officers}
                      </p>

                    </div>

                    <div className="bg-blue-50 text-blue-600 p-3 rounded-lg">
                      <Users size={25} />
                    </div>

                  </div>

                  {officerData.officers.length === 0 ? (

                    <p className="text-slate-500 text-sm">
                      No active field officers found in this branch.
                    </p>

                  ) : (

                    <div className="overflow-x-auto">

                      <table className="w-full text-sm text-left">

                        <thead className="bg-slate-50 text-slate-600">

                          <tr>
                            <th className="p-3">Officer</th>
                            <th className="p-3">Assigned Loans</th>
                            <th className="p-3">Outstanding</th>
                            <th className="p-3">Overdue</th>
                            <th className="p-3">Activities</th>
                            <th className="p-3">Payments Recorded</th>
                            <th className="p-3">Promises</th>
                          </tr>

                        </thead>

                        <tbody>

                          {officerData.officers.map((officer) => (

                            <tr
                              key={officer.officer_id}
                              className="border-b hover:bg-slate-50"
                            >

                              <td className="p-3">

                                <p className="font-semibold text-slate-800">
                                  {officer.officer_name}
                                </p>

                                <p className="text-xs text-slate-500">
                                  {officer.branch}
                                </p>

                              </td>

                              <td className="p-3">
                                {officer.assigned_loans}
                              </td>

                              <td className="p-3 font-medium">
                                {currency(
                                  officer.total_outstanding_amount
                                )}
                              </td>

                              <td className="p-3 text-amber-600 font-semibold">
                                {officer.overdue_loans}
                              </td>

                              <td className="p-3">
                                {officer.collection_activities}
                              </td>

                              <td className="p-3 text-green-600 font-semibold">
                                {officer.payments_received}
                              </td>

                              <td className="p-3 text-blue-600 font-semibold">
                                {officer.promises_obtained}
                              </td>

                            </tr>

                          ))}

                        </tbody>

                      </table>

                    </div>

                  )}

                  <p className="text-xs text-slate-500 mt-4">

                    Promise count represents promises associated with
                    the officer's assigned loans. Payment count
                    represents activities recorded with a paid outcome.

                  </p>

                </>

              )}

            </Section>

            {/* PROMISE MANAGEMENT */}

            <Section title="Promise Management">

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">

                <div>

                  <p className="text-sm text-slate-500">
                    Track borrower payment commitments and update their status.
                  </p>

                  <p className="text-xs text-slate-400 mt-1">
                    {promiseData?.total_promises ?? 0} promises recorded
                  </p>

                </div>

                <button
                  onClick={() => void fetchPromises()}
                  disabled={promiseLoading}
                  className="flex items-center justify-center gap-2 border px-4 py-2 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-50"
                >

                  <RefreshCw size={15} />

                  Refresh Promises

                </button>

              </div>

              {/* PROMISE MESSAGES */}

              {promiseMessage && (

                <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
                  {promiseMessage}
                </div>

              )}

              {promiseError && (

                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {promiseError}
                </div>

              )}

              {/* PROMISE SUMMARY */}

              {promiseData && (

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">

                  <Metric
                    title="Total Promises"
                    value={promiseData.total_promises}
                  />

                  <Metric
                    title="Pending"
                    value={
                      promiseData.promises.filter(
                        (p) => p.status === "pending"
                      ).length
                    }
                    color="text-blue-600"
                  />

                  <Metric
                    title="Fulfilled"
                    value={
                      promiseData.promises.filter(
                        (p) => p.status === "fulfilled"
                      ).length
                    }
                    color="text-green-600"
                  />

                  <Metric
                    title="Broken / Overdue"
                    value={
                      promiseData.promises.filter(
                        (p) =>
                          p.status === "broken" ||
                          p.status === "overdue"
                      ).length
                    }
                    color="text-red-600"
                  />

                </div>

              )}

              {/* PROMISE TABLE */}

              {promiseLoading && (

                <p className="py-8 text-center text-slate-500">
                  Loading payment promises...
                </p>

              )}

              {!promiseLoading &&
                promiseData &&
                promiseData.promises.length === 0 && (

                  <div className="py-10 text-center text-slate-500">

                    <CalendarDays
                      size={32}
                      className="mx-auto mb-3 text-slate-400"
                    />

                    No payment promises found.

                  </div>

                )}

              {!promiseLoading &&
                promiseData &&
                promiseData.promises.length > 0 && (

                  <div className="overflow-x-auto">

                    <table className="w-full text-sm text-left">

                      <thead className="bg-slate-50 text-slate-600">

                        <tr>
                          <th className="p-3">Loan / Borrower</th>
                          <th className="p-3">Promised Amount</th>
                          <th className="p-3">Payment Date</th>
                          <th className="p-3">Officer</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Action</th>
                        </tr>

                      </thead>

                      <tbody>

                        {promiseData.promises.map((promise) => {

                          const finalStatus =
                            promise.status.toLowerCase();

                          const canUpdate =
                            finalStatus === "pending" ||
                            finalStatus === "overdue";

                          return (

                            <tr
                              key={promise.promise_id}
                              className="border-b hover:bg-slate-50"
                            >

                              <td className="p-3">

                                <p className="font-semibold text-slate-800">
                                  {promise.loan_id}
                                </p>

                                <p className="text-xs text-slate-500">
                                  {promise.borrower_name}
                                </p>

                                <p className="text-xs text-slate-400 mt-1">
                                  {promise.dpd} DPD
                                </p>

                              </td>

                              <td className="p-3 font-semibold">
                                {currency(promise.promised_amount)}
                              </td>

                              <td className="p-3">

                                <div className="flex items-center gap-2">

                                  <CalendarDays
                                    size={15}
                                    className="text-slate-400"
                                  />

                                  {formatDate(promise.promised_date)}

                                </div>

                              </td>

                              <td className="p-3">
                                {promise.officer_name}
                              </td>

                              <td className="p-3">

                                <span
                                  className={`inline-block px-3 py-1 rounded-full text-xs font-semibold capitalize ${getStatusStyle(
                                    promise.status
                                  )}`}
                                >
                                  {promise.status}
                                </span>

                              </td>

                              <td className="p-3">

                                {canUpdate ? (

                                  <div className="flex flex-col gap-2 min-w-[145px]">

                                    <button
                                      onClick={() =>
                                        void updatePromiseStatus(
                                          promise.promise_id,
                                          "fulfilled"
                                        )
                                      }
                                      disabled={
                                        updatingPromise !== null
                                      }
                                      className="flex items-center justify-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                                    >

                                      <CheckCircle size={14} />

                                      {updatingPromise === promise.promise_id
                                        ? "Updating..."
                                        : "Mark Fulfilled"}

                                    </button>

                                    <button
                                      onClick={() =>
                                        void updatePromiseStatus(
                                          promise.promise_id,
                                          "broken"
                                        )
                                      }
                                      disabled={
                                        updatingPromise !== null
                                      }
                                      className="flex items-center justify-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                                    >

                                      <XCircle size={14} />

                                      Mark Broken

                                    </button>

                                  </div>

                                ) : (

                                  <span className="text-xs text-slate-400">
                                    No action required
                                  </span>

                                )}

                              </td>

                            </tr>

                          );

                        })}

                      </tbody>

                    </table>

                  </div>

                )}

            </Section>

            {/* DPD DISTRIBUTION */}

            <Section title="Overdue Loan Distribution">

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                <Metric
                  title="Current Loans"
                  value={data.loan_overview.dpd_distribution.current}
                  color="text-green-600"
                />

                <Metric
                  title="1–30 Days Overdue"
                  value={data.loan_overview.dpd_distribution["1_30_dpd"]}
                  color="text-amber-600"
                />

                <Metric
                  title="31–60 Days Overdue"
                  value={data.loan_overview.dpd_distribution["31_60_dpd"]}
                  color="text-orange-600"
                />

                <Metric
                  title="61+ Days Overdue"
                  value={data.loan_overview.dpd_distribution["61_plus_dpd"]}
                  color="text-red-600"
                />

              </div>

            </Section>

            {/* ACTIVITY TRACKING */}

            <Section title="Collection Activity Overview">

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">

                <Metric
                  title="Total Activities"
                  value={data.collection_activity_overview.total}
                />

                <Metric
                  title="Payments Received"
                  value={data.collection_activity_overview.paid}
                  color="text-green-600"
                />

                <Metric
                  title="Promises to Pay"
                  value={data.collection_activity_overview.promise}
                  color="text-blue-600"
                />

                <Metric
                  title="Not Reachable"
                  value={data.collection_activity_overview.not_reachable}
                  color="text-amber-600"
                />

                <Metric
                  title="Disputes"
                  value={data.collection_activity_overview.dispute}
                  color="text-red-600"
                />

                <Metric
                  title="Contact Blocked"
                  value={data.collection_activity_overview.contact_blocked}
                  color="text-orange-600"
                />

              </div>

            </Section>

            {/* ROLL RATE */}

            <Section title="Roll Rate Performance">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                <div className="border rounded-xl p-5">

                  <div className="flex items-center gap-2 mb-3">

                    <TrendingUp className="text-blue-600" />

                    <h4 className="font-semibold">
                      Roll Rate Targets
                    </h4>

                  </div>

                  <div className="flex justify-between py-3 border-b">

                    <span className="text-slate-500">
                      Baseline Roll Rate
                    </span>

                    <strong>
                      {data.roll_rate_tracking.baseline_roll_rate_percent}%
                    </strong>

                  </div>

                  <div className="flex justify-between py-3">

                    <span className="text-slate-500">
                      Target Roll Rate
                    </span>

                    <strong className="text-green-600">
                      {data.roll_rate_tracking.target_roll_rate_percent}%
                    </strong>

                  </div>

                </div>

                <div className="border rounded-xl p-5">

                  <div className="flex items-center gap-2 mb-3">

                    <Target className="text-blue-600" />

                    <h4 className="font-semibold">
                      Current DPD Movement
                    </h4>

                  </div>

                  <div className="flex justify-between py-3 border-b">

                    <span className="text-slate-500">
                      1–30 DPD Loans
                    </span>

                    <strong>
                      {data.roll_rate_tracking.current_1_30_dpd_loans}
                    </strong>

                  </div>

                  <div className="flex justify-between py-3">

                    <span className="text-slate-500">
                      31–60 DPD Loans
                    </span>

                    <strong>
                      {data.roll_rate_tracking.current_31_60_dpd_loans}
                    </strong>

                  </div>

                </div>

              </div>

              <div className="mt-4 p-4 rounded-lg bg-amber-50 text-amber-800 text-sm flex gap-3">

                <AlertTriangle
                  size={20}
                  className="shrink-0"
                />

                <p>
                  {data.roll_rate_tracking.note}
                </p>

              </div>

              {!data.roll_rate_tracking.historical_roll_rate_available && (

                <p className="text-xs text-slate-500 mt-2">

                  Historical roll-rate calculation is not yet available.
                  The baseline and target are reference business metrics,
                  not measured current performance.

                </p>

              )}

            </Section>

            {/* CONNECTION STATUS */}

            <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-center gap-3">

              <CheckCircle
                className="text-green-600"
                size={24}
              />

              <div>

                <p className="font-semibold text-green-800">
                  Manager dashboard connected
                </p>

                <p className="text-sm text-green-700">
                  Dashboard information loaded from the CollectIQ backend.
                </p>

              </div>

            </div>

          </>

        )}

      </main>

    </div>

  );
}

// ---------------------------------------------------------
// REUSABLE SECTION
// ---------------------------------------------------------

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {

  return (

    <section className="bg-white border rounded-xl shadow-sm p-6 mb-6">

      <h3 className="text-lg font-bold text-slate-900 mb-5">
        {title}
      </h3>

      {children}

    </section>

  );
}

// ---------------------------------------------------------
// REUSABLE METRIC
// ---------------------------------------------------------

function Metric({
  title,
  value,
  color = "text-slate-900",
}: {
  title: string;
  value: number;
  color?: string;
}) {

  return (

    <div className="bg-slate-50 border rounded-lg p-4">

      <p className="text-sm text-slate-500">
        {title}
      </p>

      <p className={`text-2xl font-bold mt-2 ${color}`}>
        {value}
      </p>

    </div>

  );
}

// ---------------------------------------------------------
// REUSABLE SUMMARY CARD
// ---------------------------------------------------------

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

      <div className="flex justify-between items-center gap-3">

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