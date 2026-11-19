import { create } from 'zustand';

/**
 * @file dialogStore.js
 * @description Tüm uygulamada ortak, türüne göre renklenen (success, error, warning, info, confirm),
 * Promise tabanlı modern diyalog ve bildirim pop-up mağazası.
 */
let dialogResolver = null;

const useDialogStore = create((set, get) => ({
  isOpen: false,
  title: '',
  message: '',
  type: 'info', // 'success' | 'error' | 'warning' | 'info' | 'confirm'
  confirmText: 'Tamam',
  cancelText: 'Vazgeç',
  isDestructive: false,
  onConfirm: null,

  // Temel Promise Tabanlı Açıcı
  openDialog: ({
    title = '',
    message = '',
    type = 'info',
    confirmText,
    cancelText = 'Vazgeç',
    isDestructive = false,
    onConfirm = null
  }) => {
    return new Promise((resolve) => {
      dialogResolver = resolve;
      
      let defaultConfirmText = 'Tamam';
      if (type === 'confirm') defaultConfirmText = isDestructive ? 'Evet, Sil' : 'Evet, Onaylıyorum';
      else if (type === 'success') defaultConfirmText = 'Anladım';
      else if (type === 'error') defaultConfirmText = 'Kapat';

      set({
        isOpen: true,
        title,
        message,
        type,
        confirmText: confirmText || defaultConfirmText,
        cancelText,
        isDestructive: isDestructive || type === 'confirm' && (title.toLowerCase().includes('sil') || message.toLowerCase().includes('sil')),
        onConfirm
      });
    });
  },

  // Başarı Pop-up'ı (Yeşil)
  showSuccess: (arg1, arg2, options = {}) => {
    const isSingle = arg2 === undefined || (typeof arg2 === 'object' && arg2 !== null && !options.title);
    const title = isSingle ? (options.title || 'İşlem Başarılı') : arg1;
    const message = isSingle ? (typeof arg1 === 'string' ? arg1 : '') : arg2;
    const opts = (typeof arg2 === 'object' && arg2 !== null) ? arg2 : options;
    return get().openDialog({
      title,
      message,
      type: 'success',
      ...opts
    });
  },

  // Hata Pop-up'ı (Kırmızı)
  showError: (arg1, arg2, options = {}) => {
    const isSingle = arg2 === undefined || (typeof arg2 === 'object' && arg2 !== null && !options.title);
    const title = isSingle ? (options.title || 'Bir Hata Oluştu') : arg1;
    const message = isSingle ? (typeof arg1 === 'string' ? arg1 : '') : arg2;
    const opts = (typeof arg2 === 'object' && arg2 !== null) ? arg2 : options;
    return get().openDialog({
      title,
      message,
      type: 'error',
      ...opts
    });
  },

  // Uyarı Pop-up'ı (Turuncu / Amber)
  showWarning: (arg1, arg2, options = {}) => {
    const isSingle = arg2 === undefined || (typeof arg2 === 'object' && arg2 !== null && !options.title);
    const title = isSingle ? (options.title || 'Dikkat') : arg1;
    const message = isSingle ? (typeof arg1 === 'string' ? arg1 : '') : arg2;
    const opts = (typeof arg2 === 'object' && arg2 !== null) ? arg2 : options;
    return get().openDialog({
      title,
      message,
      type: 'warning',
      ...opts
    });
  },

  // Bilgi Pop-up'ı (Mavi)
  showInfo: (arg1, arg2, options = {}) => {
    const isSingle = arg2 === undefined || (typeof arg2 === 'object' && arg2 !== null && !options.title);
    const title = isSingle ? (options.title || 'Bilgilendirme') : arg1;
    const message = isSingle ? (typeof arg1 === 'string' ? arg1 : '') : arg2;
    const opts = (typeof arg2 === 'object' && arg2 !== null) ? arg2 : options;
    return get().openDialog({
      title,
      message,
      type: 'info',
      ...opts
    });
  },

  // Onay Pop-up'ı (İki butonlu, Promise veya Callback destekli)
  showConfirm: (arg1, arg2, optionsOrCb = {}) => {
    let title = 'Onay Gerekiyor';
    let message = '';
    let opts = {};
    let onConfirm = null;

    if (typeof arg2 === 'function') {
      title = arg1;
      onConfirm = arg2;
    } else if (arg2 === undefined) {
      // Tek parametre verildi: dialog.confirm("Mesaj...")
      message = arg1;
    } else if (typeof arg2 === 'object' && arg2 !== null) {
      // dialog.confirm("Mesaj...", { confirmText: 'Evet' })
      message = arg1;
      opts = arg2;
    } else {
      // dialog.confirm("Başlık", "Mesaj", options)
      title = arg1;
      message = arg2;
      if (typeof optionsOrCb === 'function') {
        onConfirm = optionsOrCb;
      } else if (typeof optionsOrCb === 'object') {
        opts = optionsOrCb;
      }
    }

    return get().openDialog({
      title: opts.title || title,
      message,
      type: 'confirm',
      onConfirm: onConfirm || opts.onConfirm,
      ...opts
    });
  },

  // Genel Uyarı (Geriye dönük uyumluluk)
  showAlert: (arg1, arg2, options = {}) => {
    const isSingle = arg2 === undefined;
    const title = isSingle ? 'Bilgilendirme' : arg1;
    const message = isSingle ? arg1 : arg2;
    const opts = (typeof arg2 === 'object' && arg2 !== null) ? arg2 : options;
    return get().openDialog({
      title,
      message,
      type: opts.type || 'info',
      ...opts
    });
  },

  // Kapatma Fonksiyonu
  closeDialog: (result = false) => {
    const { onConfirm } = get();
    if (result && typeof onConfirm === 'function') {
      try {
        onConfirm();
      } catch (err) {
        console.error('Dialog onConfirm hatası:', err);
      }
    }
    if (dialogResolver) {
      dialogResolver(result);
      dialogResolver = null;
    }
    set({ isOpen: false, onConfirm: null });
  }
}));

// Doğrudan bileşen dışından veya async fonksiyonlardan import edilip kullanılabilen kolay yardımcı nesne
export const dialog = {
  success: (title, message, options) => useDialogStore.getState().showSuccess(title, message, options),
  error: (title, message, options) => useDialogStore.getState().showError(title, message, options),
  warning: (title, message, options) => useDialogStore.getState().showWarning(title, message, options),
  info: (title, message, options) => useDialogStore.getState().showInfo(title, message, options),
  confirm: (title, message, options) => useDialogStore.getState().showConfirm(title, message, options),
  alert: (title, message, options) => useDialogStore.getState().showAlert(title, message, options),
  close: (result) => useDialogStore.getState().closeDialog(result)
};

if (typeof window !== 'undefined') {
  window.dialog = dialog;
}

export default useDialogStore;
