export interface AuthUser {
  id: number;
  full_name: string;
  email: string;
  role: "field_officer" | "branch_manager";
  branch: string | null;
  is_active: boolean;
}