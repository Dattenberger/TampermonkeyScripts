const Styles = {
  exportButton: `
    a.export-btn {
      display: inline-flex;
      align-items: center;
      gap: .5rem;
      cursor: pointer;
      text-decoration: none;
      margin-left: 5px;
      transition: opacity 0.2s ease;
      border-radius: 8px;
      padding: 12px 24px;
      border: 1px solid #3d3d3c;
      font-family: "Husqvarna Gothic", Arial, sans-serif;
      line-height: 16px;
      font-size: 14px;
      text-transform: uppercase;
    }
    a.export-btn.loading { background: #6f6f6f; color: white; pointer-events: none; }
    a.export-btn.queued { background-color: #ffc107; border-color: #ffc107; color: #212529; pointer-events: none; }
    a.export-btn.success { background-color: #28a745; border-color: #28a745; color: white; }
    a.export-btn.success:hover { background-color: #218838; border-color: #1e7e34; }
    a.export-btn.error { background-color: #dc3545; border-color: #dc3545; color: white; }
    a.export-btn.error:hover { background-color: #c82333; border-color: #bd2130; }
  `,

  customOrderInput: `
    .datte-custom-order-container { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border: 1px solid #e0e0e0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .datte-custom-order-group { display: flex; gap: 12px; align-items: flex-end; width: 100%; }
    .datte-custom-order-wrapper { flex: 1; min-width: 300px; }
    .datte-custom-order-label { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-weight: 600; font-size: 14px; color: #3d3d3c; font-family: "Husqvarna Gothic", Arial, sans-serif; }
    .datte-muted { font-size: 12px; font-weight: 400; color: #999; }
    .datte-custom-order-input { width: 100%; padding: 12px 16px; border: 1px solid #3d3d3c; border-radius: 8px; font-size: 14px; font-family: "Husqvarna Gothic", Arial, sans-serif; transition: border-color 0.2s ease; }
    .datte-custom-order-input:focus { outline: none; border-color: #000; }
    .datte-custom-order-input.error { border-color: #dc3545; }
    .datte-custom-order-error { color: #dc3545; font-size: 12px; margin-top: 6px; display: none; font-family: "Husqvarna Gothic", Arial, sans-serif; }
    .datte-custom-order-error.show { display: block; }
    .datte-custom-order-btn { display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; text-decoration: none; padding: 12px 32px; border-radius: 8px; border: 1px solid #3d3d3c; background: white; font-family: "Husqvarna Gothic", Arial, sans-serif; line-height: 16px; font-size: 14px; text-transform: uppercase; transition: background-color 0.2s ease, border-color 0.2s ease; white-space: nowrap; }
    .datte-custom-order-btn:hover:not(.loading):not(.disabled) { background: #f5f5f5; }
    .datte-custom-order-btn.loading { background: #6f6f6f; color: white; pointer-events: none; }
    .datte-custom-order-btn.disabled { opacity: 0.5; pointer-events: none; }
    .datte-custom-order-btn.success { background-color: #28a745; border-color: #28a745; color: white; }
    .datte-custom-order-btn.error { background-color: #dc3545; border-color: #dc3545; color: white; }
  `,

  confirmModal: `
    .datte-confirm-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 10000; animation: fadeIn 0.2s ease; }
    .datte-confirm-dialog { background: white; border-radius: 8px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3); max-width: 500px; width: 90%; max-height: 80vh; overflow: hidden; display: flex; flex-direction: column; animation: slideIn 0.2s ease; }
    .datte-confirm-header { padding: 20px; border-bottom: 1px solid #e0e0e0; font-family: "Husqvarna Gothic", Arial, sans-serif; }
    .datte-confirm-title { font-size: 18px; font-weight: 600; color: #3d3d3c; display: flex; align-items: center; gap: 8px; }
    .datte-confirm-body { padding: 20px; overflow-y: auto; flex: 1; font-family: "Husqvarna Gothic", Arial, sans-serif; color: #3d3d3c; }
    .datte-confirm-order-list { margin: 15px 0; padding: 15px; background: #f5f5f5; border-radius: 4px; max-height: 200px; overflow-y: auto; font-family: monospace; font-size: 14px; line-height: 1.6; word-break: break-all; }
    .datte-confirm-actions { padding: 15px 20px; border-top: 1px solid #e0e0e0; display: flex; gap: 12px; justify-content: flex-end; }
    .datte-confirm-btn { padding: 10px 20px; border-radius: 6px; border: 1px solid #3d3d3c; font-family: "Husqvarna Gothic", Arial, sans-serif; font-size: 14px; cursor: pointer; transition: all 0.2s ease; }
    .datte-confirm-btn-cancel { background: white; color: #3d3d3c; }
    .datte-confirm-btn-cancel:hover { background: #f5f5f5; }
    .datte-confirm-btn-ok { background: #3d3d3c; color: white; border-color: #3d3d3c; display: flex; align-items: center; gap: 6px; }
    .datte-confirm-btn-ok:hover { background: #2d2d2c; }
    .datte-enter-icon { width: 16px; height: 16px; flex-shrink: 0; }
  `,

  statusDisplay: `
    .datte-download-status-container { margin-top: 20px; padding: 15px; background: #f9f9f9; border-radius: 8px; border: 1px solid #e0e0e0; }
    .datte-download-status-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .datte-download-status-title { font-family: "Husqvarna Gothic", Arial, sans-serif; font-size: 14px; font-weight: 600; color: #3d3d3c; }
    .datte-download-status-clear-btn { background: transparent; border: none; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: background-color 0.2s ease; display: flex; align-items: center; gap: 4px; font-family: "Husqvarna Gothic", Arial, sans-serif; font-size: 13px; color: #666; }
    .datte-download-status-clear-btn:hover { background: #e0e0e0; }
    .datte-download-status-list { display: flex; flex-wrap: wrap; gap: 8px; }
    .datte-download-status-item { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 8px; border: 1px solid #3d3d3c; font-family: "Husqvarna Gothic", Arial, sans-serif; font-size: 13px; font-weight: 500; transition: all 0.2s ease; white-space: nowrap; }
    .datte-download-status-item.status-pending { background: #fff3cd; border-color: #ffc107; color: #856404; }
    .datte-download-status-item.status-loading { background: #6f6f6f; border-color: #6f6f6f; color: white; }
    .datte-download-status-item.status-success { background: #28a745; border-color: #28a745; color: white; }
    .datte-download-status-item.status-error { background: #dc3545; border-color: #dc3545; color: white; }
    .datte-download-status-number { font-family: monospace; font-weight: 600; }
    .datte-download-status-icon { flex-shrink: 0; display: flex; align-items: center; }
  `,

  animations: `
    .loading-spinner { animation: spin 1s linear infinite; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideIn { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  `,
};

export function applyStyles(): void {
  Object.values(Styles).forEach(css => GM_addStyle(css));
}
