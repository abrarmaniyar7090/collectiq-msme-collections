import { useCallback, useEffect, useState } from "react";
import axios from "axios";

import {
  Bell,
  RefreshCw,
  Send,
  CheckCircle,
  FileText,
  ShieldCheck,
  Clock,
} from "lucide-react";

import api from "../services/api";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

interface ReminderLoan {
  databaseId: number;
  loanId: string;
  borrowerName: string;
}

type ReminderLanguage = "english" | "hindi";

type ReminderTemplateType =
  | "payment_due"
  | "payment_overdue"
  | "promise_reminder";

type ReminderStatus =
  | "draft"
  | "approved"
  | "sent";

interface ReminderRecord {
  reminder_id: number;
  loan_id: number;
  language: string;
  template_type: string;
  message: string;
  status: string;
  created_at: string | null;
  approved_at: string | null;
  sent_at: string | null;
}

interface ReminderHistoryResponse {
  reminders: ReminderRecord[];
  total_reminders?: number;
}

interface ReminderDraft {
  message: string;
  reminder_id: number;
  loan_id: string;
  borrower_name: string;
  phone_number: string | null;
  language: ReminderLanguage;
  draft: string;
  safety_check: string;
  status: ReminderStatus;
  officer_approval_required: boolean;
  contact_allowed_now: boolean;
  sending_status?: string;
}

interface ReminderActionResponse {
  message?: string;
  reminder_id: number;
  status: ReminderStatus;
  approved_by?: number;
  approved_at?: string;
  actual_message_sent?: boolean;
  delivery_mode?: string;
}

interface Props {
  loans: ReminderLoan[];
}

interface ApiErrorResponse {
  detail?: string;
}

// --------------------------------------------------
// CONSTANTS
// --------------------------------------------------

const templates: {
  value: ReminderTemplateType;
  label: string;
}[] = [
  {
    value: "payment_due",
    label: "Payment Due",
  },
  {
    value: "payment_overdue",
    label: "Payment Overdue",
  },
  {
    value: "promise_reminder",
    label: "Promise Reminder",
  },
];

// --------------------------------------------------
// ERROR HANDLING
// --------------------------------------------------

function getErrorMessage(
  error: unknown,
  fallback: string
): string {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
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
// REMINDER MANAGER COMPONENT
// --------------------------------------------------

export default function ReminderManager({
  loans,
}: Props) {

  const [loanId, setLoanId] = useState("");

  const [language, setLanguage] =
    useState<ReminderLanguage>("english");

  const [templateType, setTemplateType] =
    useState<ReminderTemplateType>("payment_overdue");

  const [draft, setDraft] =
    useState<ReminderDraft | null>(null);

  const [history, setHistory] =
    useState<ReminderRecord[]>([]);

  const [loading, setLoading] = useState(false);

  const [historyLoading, setHistoryLoading] =
    useState(false);

  const [actionLoading, setActionLoading] =
    useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const [contactAllowed, setContactAllowed] =
    useState<boolean | null>(null);

  // --------------------------------------------------
  // FETCH REMINDER HISTORY
  // --------------------------------------------------

  const fetchHistory = useCallback(
    async (): Promise<void> => {

      try {
        setHistoryLoading(true);

        const response =
          await api.get<ReminderHistoryResponse>(
            "/api/v1/reminders/history"
          );

        setHistory(
          response.data.reminders || []
        );

      } catch (err: unknown) {

        setError(
          getErrorMessage(
            err,
            "Unable to load reminder history."
          )
        );

      } finally {
        setHistoryLoading(false);
      }

    },
    []
  );

  // --------------------------------------------------
  // INITIAL HISTORY LOAD
  // --------------------------------------------------

  useEffect(() => {

    // Defer the request until after the effect completes.
    const timer = window.setTimeout(() => {
      void fetchHistory();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };

  }, [fetchHistory]);

  // --------------------------------------------------
  // GENERATE REMINDER DRAFT
  // --------------------------------------------------

  const generateDraft = async (): Promise<void> => {

    if (!loanId) {

      setError("Please select a loan.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");
      setDraft(null);
      setContactAllowed(null);

      const response =
        await api.post<ReminderDraft>(
          "/api/v1/reminders/draft",
          {
            loan_id: Number(loanId),
            language,
            template_type: templateType,
          }
        );

      setDraft(response.data);

      setContactAllowed(
        response.data.contact_allowed_now
      );

      setSuccess(
        "Reminder draft generated successfully. Review it before approval."
      );

      await fetchHistory();

    } catch (err: unknown) {

      setError(
        getErrorMessage(
          err,
          "Unable to generate reminder."
        )
      );

    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // APPROVE REMINDER
  // --------------------------------------------------

  const approveReminder = async (): Promise<void> => {

    if (!draft?.reminder_id) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      const response =
        await api.post<ReminderActionResponse>(
          `/api/v1/reminders/${draft.reminder_id}/approve`
        );

      setDraft((previous) =>
        previous
          ? {
              ...previous,
              status: response.data.status,
            }
          : previous
      );

      setSuccess(
        "Reminder approved successfully."
      );

      await fetchHistory();

    } catch (err: unknown) {

      setError(
        getErrorMessage(
          err,
          "Unable to approve reminder."
        )
      );

    } finally {
      setActionLoading(false);
    }
  };

  // --------------------------------------------------
  // SEND REMINDER
  // --------------------------------------------------

  const sendReminder = async (): Promise<void> => {

    if (!draft?.reminder_id) {
      return;
    }

    const confirmed = window.confirm(
      "Send this approved reminder through the mock messaging system?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setActionLoading(true);
      setError("");
      setSuccess("");

      const response =
        await api.post<ReminderActionResponse>(
          `/api/v1/reminders/${draft.reminder_id}/send`
        );

      setDraft((previous) =>
        previous
          ? {
              ...previous,
              status: response.data.status,
              sending_status: response.data.actual_message_sent
                ? "sent"
                : "mock_sent",
            }
          : previous
      );

      setSuccess(
        "Reminder processed successfully through mock messaging. No actual SMS or WhatsApp message was sent."
      );

      await fetchHistory();

    } catch (err: unknown) {

      setError(
        getErrorMessage(
          err,
          "Unable to send reminder."
        )
      );

    } finally {
      setActionLoading(false);
    }
  };

  // --------------------------------------------------
  // FORMAT DATE
  // --------------------------------------------------

  const formatDate = (
    value: string | null
  ): string => {

    if (!value) {
      return "Not available";
    }

    return new Date(value).toLocaleString("en-IN");
  };

  // --------------------------------------------------
  // STATUS STYLE
  // --------------------------------------------------

  const statusStyle = (
    status: string
  ): string => {

    switch (status.toLowerCase()) {

      case "sent":
        return "bg-green-100 text-green-700";

      case "approved":
        return "bg-blue-100 text-blue-700";

      case "draft":
        return "bg-amber-100 text-amber-700";

      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (

    <section className="mt-8 rounded-xl border bg-white p-6 shadow-sm">

      {/* HEADER */}

      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">

        <div>

          <div className="flex items-center gap-2">

            <Bell
              className="text-blue-600"
              size={23}
            />

            <h3 className="text-lg font-bold text-slate-900">
              AI Reminder Generator
            </h3>

          </div>

          <p className="mt-1 text-sm text-slate-500">
            Generate, review, approve and send borrower payment reminders.
          </p>

        </div>

        <button
          onClick={() => void fetchHistory()}
          disabled={historyLoading}
          className="flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
        >

          <RefreshCw size={16} />

          Refresh History

        </button>

      </div>

      {/* FORM */}

      <div className="rounded-xl border bg-slate-50 p-5">

        <h4 className="mb-4 font-semibold text-slate-800">
          Generate New Reminder
        </h4>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

          {/* LOAN */}

          <div>

            <label className="mb-2 block text-sm font-medium">
              Select Loan
            </label>

            <select
              value={loanId}
              onChange={(e) => setLoanId(e.target.value)}
              className="w-full rounded-lg border bg-white p-3"
            >

              <option value="">
                Select a borrower
              </option>

              {loans.map((loan) => (

                <option
                  key={loan.databaseId}
                  value={loan.databaseId}
                >
                  {loan.loanId} - {loan.borrowerName}
                </option>

              ))}

            </select>

          </div>

          {/* LANGUAGE */}

          <div>

            <label className="mb-2 block text-sm font-medium">
              Language
            </label>

            <select
              value={language}
              onChange={(e) =>
                setLanguage(
                  e.target.value as ReminderLanguage
                )
              }
              className="w-full rounded-lg border bg-white p-3"
            >

              <option value="english">
                English
              </option>

              <option value="hindi">
                Hindi
              </option>

            </select>

          </div>

          {/* TEMPLATE */}

          <div>

            <label className="mb-2 block text-sm font-medium">
              Reminder Template
            </label>

            <select
              value={templateType}
              onChange={(e) =>
                setTemplateType(
                  e.target.value as ReminderTemplateType
                )
              }
              className="w-full rounded-lg border bg-white p-3"
            >

              {templates.map((template) => (

                <option
                  key={template.value}
                  value={template.value}
                >
                  {template.label}
                </option>

              ))}

            </select>

          </div>

        </div>

        <button
          onClick={() => void generateDraft()}
          disabled={loading || loans.length === 0}
          className="mt-5 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >

          <FileText size={18} />

          {loading
            ? "Generating..."
            : "Generate Reminder"}

        </button>

      </div>

      {/* MESSAGES */}

      {error && (

        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>

      )}

      {success && (

        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {success}
        </div>

      )}

      {/* DRAFT PREVIEW */}

      {draft && (

        <div className="mt-6 rounded-xl border border-blue-200 p-5">

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">

            <h4 className="font-bold text-slate-900">
              Reminder Preview
            </h4>

            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusStyle(
                draft.status
              )}`}
            >
              {draft.status}
            </span>

          </div>

          {/* BORROWER DETAILS */}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

            <div>

              <p className="text-xs text-slate-500">
                Borrower
              </p>

              <p className="font-semibold">
                {draft.borrower_name}
              </p>

            </div>

            <div>

              <p className="text-xs text-slate-500">
                Loan Reference
              </p>

              <p className="font-semibold">
                {draft.loan_id}
              </p>

            </div>

            <div>

              <p className="text-xs text-slate-500">
                Phone Number
              </p>

              <p className="font-semibold">
                {draft.phone_number || "Not available"}
              </p>

            </div>

            <div>

              <p className="text-xs text-slate-500">
                Language
              </p>

              <p className="font-semibold capitalize">
                {draft.language}
              </p>

            </div>

          </div>

          {/* MESSAGE PREVIEW */}

          <div className="mt-5 rounded-lg bg-slate-50 p-4">

            <p className="mb-2 text-sm font-semibold text-slate-700">
              Message Preview
            </p>

            <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {draft.draft}
            </p>

          </div>

          {/* SAFETY CHECK */}

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">

            <ShieldCheck
              size={19}
              className="text-green-600"
            />

            <span className="font-semibold text-green-700">
              Safety Check: {draft.safety_check}
            </span>

          </div>

          {/* CONTACT HOURS */}

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">

            <Clock
              size={18}
              className="text-slate-500"
            />

            <span className="text-slate-600">
              Contact hours:
            </span>

            <span
              className={
                contactAllowed
                  ? "font-semibold text-green-700"
                  : "font-semibold text-red-600"
              }
            >

              {contactAllowed
                ? "Currently allowed (8 AM – 7 PM IST)"
                : "Outside permitted hours (8 AM – 7 PM IST)"}

            </span>

          </div>

          {/* APPROVAL AND SEND */}

          <div className="mt-5 flex flex-wrap gap-3">

            {draft.status === "draft" && (

              <button
                onClick={() => void approveReminder()}
                disabled={actionLoading}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >

                <CheckCircle size={17} />

                {actionLoading
                  ? "Processing..."
                  : "Approve Reminder"}

              </button>

            )}

            {draft.status === "approved" && (

              <button
                onClick={() => void sendReminder()}
                disabled={
                  actionLoading ||
                  contactAllowed === false
                }
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >

                <Send size={17} />

                {actionLoading
                  ? "Sending..."
                  : "Send Reminder"}

              </button>

            )}

            {draft.status === "sent" && (

              <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">

                <CheckCircle size={18} />

                Mock sending completed. No actual message was sent.

              </div>

            )}

          </div>

          {draft.status === "approved" &&
            contactAllowed === false && (

              <p className="mt-3 text-sm text-red-600">
                Sending is disabled outside permitted contact hours.
              </p>

            )}

        </div>

      )}

      {/* REMINDER HISTORY */}

      <div className="mt-8">

        <h4 className="mb-4 font-bold text-slate-900">
          Reminder History
        </h4>

        {historyLoading && (

          <p className="py-6 text-center text-sm text-slate-500">
            Loading reminder history...
          </p>

        )}

        {!historyLoading &&
          history.length === 0 && (

            <div className="rounded-lg border border-dashed p-8 text-center text-slate-500">
              No reminders generated yet.
            </div>

          )}

        {!historyLoading &&
          history.length > 0 && (

            <div className="space-y-3">

              {history.map((item) => (

                <div
                  key={item.reminder_id}
                  className="rounded-lg border p-4"
                >

                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">

                    <div>

                      <p className="font-semibold text-slate-800">
                        Reminder #{item.reminder_id}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Loan database ID: {item.loan_id}
                      </p>

                      <p className="mt-1 text-xs capitalize text-slate-500">
                        {item.language} ·{" "}
                        {item.template_type.replaceAll("_", " ")}
                      </p>

                    </div>

                    <span
                      className={`w-fit rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusStyle(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>

                  </div>

                  <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                    {item.message}
                  </p>

                  <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-3">

                    <p>
                      Created: {formatDate(item.created_at)}
                    </p>

                    <p>
                      Approved: {formatDate(item.approved_at)}
                    </p>

                    <p>
                      Sent: {formatDate(item.sent_at)}
                    </p>

                  </div>

                </div>

              ))}

            </div>

          )}

      </div>

      {/* DISCLAIMER */}

      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">

        Reminder messages use approved templates and require officer approval.
        Sending is simulated. No real SMS or WhatsApp messages are sent.

      </div>

    </section>

  );
}