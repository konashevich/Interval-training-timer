(function (global) {
  'use strict';

  var SUPPORTED_LOCALES = ['en', 'uk', 'ru'];
  var LOCALE_STORAGE_KEY = 'app_locale';
  var DATE_LOCALES = { en: 'en-US', uk: 'uk-UA', ru: 'ru-RU' };

  function normalizeLangCode(tag) {
    if (!tag) return '';
    return String(tag).toLowerCase().replace(/_/g, '-').split('-')[0];
  }

  function detectLocale() {
    var langs;
    try {
      if (navigator.languages && navigator.languages.length) {
        langs = Array.prototype.slice.call(navigator.languages);
      } else {
        langs = [navigator.language || 'en'];
      }
    } catch (e) {
      langs = ['en'];
    }
    for (var i = 0; i < langs.length; i++) {
      var code = normalizeLangCode(langs[i]);
      if (SUPPORTED_LOCALES.indexOf(code) !== -1) return code;
    }
    return 'en';
  }

  function loadStoredLocale() {
    try {
      var stored = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (SUPPORTED_LOCALES.indexOf(stored) !== -1) return stored;
    } catch (e) {
      // ignore
    }
    return null;
  }

  function resolveLocale() {
    return loadStoredLocale() || detectLocale();
  }

  function persistLocalePreference(locale) {
    try {
      if (locale === 'system') {
        localStorage.removeItem(LOCALE_STORAGE_KEY);
      } else if (SUPPORTED_LOCALES.indexOf(locale) !== -1) {
        localStorage.setItem(LOCALE_STORAGE_KEY, locale);
      }
    } catch (e) {
      // ignore
    }
  }

  function isSupportedLocale(locale) {
    return locale === 'system' || SUPPORTED_LOCALES.indexOf(locale) !== -1;
  }

  global.AppLocale = {
    SUPPORTED_LOCALES: SUPPORTED_LOCALES,
    LOCALE_STORAGE_KEY: LOCALE_STORAGE_KEY,
    DATE_LOCALES: DATE_LOCALES,
    detectLocale: detectLocale,
    loadStoredLocale: loadStoredLocale,
    resolveLocale: resolveLocale,
    persistLocalePreference: persistLocalePreference,
    isSupportedLocale: isSupportedLocale
  };
})(typeof window !== 'undefined' ? window : this);
