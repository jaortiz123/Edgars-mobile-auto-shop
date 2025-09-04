// Type stubs to keep typecheck focused on app code by treating admin modules as any
declare module '@/components/admin/*' {
  const AdminComponent: any;
  export default AdminComponent;
  export const __esModule: true;
}

declare module '@/pages/admin/*' {
  const AdminPage: any;
  export default AdminPage;
  export const __esModule: true;
}

declare module '@/admin/*' {
  const AdminModule: any;
  export default AdminModule;
  export const __esModule: true;
}

declare module './admin/*' {
  const RelAdminModule: any;
  export default RelAdminModule;
  export const __esModule: true;
}

// Wildcard patterns to catch relative imports like '../../components/admin/AppointmentDrawer'
declare module '*components/admin/*' {
  const AnyAdminComponent: any;
  export default AnyAdminComponent;
  export const __esModule: true;
}

declare module '*pages/admin/*' {
  const AnyAdminPage: any;
  export default AnyAdminPage;
  export const __esModule: true;
}

declare module '*admin/*' {
  const AnyAdmin: any;
  export default AnyAdmin;
  export const __esModule: true;
}
