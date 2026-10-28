import UsersList from "../../../features/users/UsersList";

export default function Users() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold text-[#111827]">Users</h1>
      <p className="mt-1 text-sm text-[#6B7280]">Create accounts, set roles and manage access</p>
      <div className="mt-6">
        <UsersList />
      </div>
    </div>
  );
}
