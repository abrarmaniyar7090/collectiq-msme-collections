import axios from "axios";
import api from "./api";

const STORAGE_KEY = "collectiq_offline_activities";

export interface OfflineActivityPayload {
  client_event_id: string;
  activity_type: "call" | "visit";
  outcome: "paid" | "promise" | "not_reachable" | "dispute";
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  occurred_at?: string;
  promised_amount?: number;
  promised_date?: string;
}

export interface OfflineActivity {
  loanDatabaseId: number;
  payload: OfflineActivityPayload;
}

export const getPendingActivities = (): OfflineActivity[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    return stored
      ? (JSON.parse(stored) as OfflineActivity[])
      : [];
  } catch {
    return [];
  }
};

export const saveOfflineActivity = (
  activity: OfflineActivity
): void => {
  const activities = getPendingActivities();

  activities.push(activity);

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(activities)
  );
};

export const syncOfflineActivities = async (): Promise<number> => {
  if (!navigator.onLine) return 0;

  const activities = getPendingActivities();

  let syncedCount = 0;

  for (const activity of activities) {
    try {
      await api.post(
        `/api/v1/loans/${activity.loanDatabaseId}/activities`,
        activity.payload
      );

      const remaining = getPendingActivities().filter(
        (item) =>
          item.payload.client_event_id !==
          activity.payload.client_event_id
      );

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(remaining)
      );

      syncedCount++;
    } catch (error: unknown) {
      // Keep the activity queued if the server cannot accept it.
      if (axios.isAxiosError(error) && error.response) {
        console.error(
          "Offline activity could not be synced:",
          error.response.data
        );
      }
    }
  }

  return syncedCount;
};