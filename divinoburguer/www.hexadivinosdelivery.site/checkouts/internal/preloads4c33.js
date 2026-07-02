
    (function() {
      var preconnectOrigins = ["https://cdn.shopify.com"];
      var scripts = ["/cdn/shopifycloud/checkout-web/assets/c1/polyfills-legacy.BCz5HLuK.js","/cdn/shopifycloud/checkout-web/assets/c1/app-legacy.Brw8Ceva.js","/cdn/shopifycloud/checkout-web/assets/c1/esnext-vendor-legacy.DX3_C7ki.js","/cdn/shopifycloud/checkout-web/assets/c1/context-browser-legacy.C4lhfyIX.js","/cdn/shopifycloud/checkout-web/assets/c1/types-UnauthenticatedErrorModalPayload-legacy.D32kT6-y.js","/cdn/shopifycloud/checkout-web/assets/c1/proposal-delegated-payment-instrument-legacy.rvGVe4SP.js","/cdn/shopifycloud/checkout-web/assets/c1/utilities-shop-discount-offer-legacy.BfcwatJa.js","/cdn/shopifycloud/checkout-web/assets/c1/consent-manager-shared-legacy.D6vaoGS6.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-useShopPayCheckoutGqlVersion-legacy.B6bqyzs-.js","/cdn/shopifycloud/checkout-web/assets/c1/graphql-PaymentSessionMutation-legacy.xesAbx6W.js","/cdn/shopifycloud/checkout-web/assets/c1/graphql-ShopPayCheckoutSessionQuery-legacy.CQ89Dmkc.js","/cdn/shopifycloud/checkout-web/assets/c1/utils-getCommonShopPayExternalTelemetryAttributes-legacy.BkZivHt6.js","/cdn/shopifycloud/checkout-web/assets/c1/graphql-UserPrivacySettingsSetMutation-legacy.CyEVBfxA.js","/cdn/shopifycloud/checkout-web/assets/c1/extensions-rpc-legacy.BSVWqh-i.js","/cdn/shopifycloud/checkout-web/assets/c1/hydrate-legacy.D7UK7_dr.js","/cdn/shopifycloud/checkout-web/assets/c1/locale-pt-BR-legacy.Bzyu3xOt.js","/cdn/shopifycloud/checkout-web/assets/c1/page-OnePage-legacy.DeWbo60K.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-useWalletsTimeout-legacy.CacE2bOo.js","/cdn/shopifycloud/checkout-web/assets/c1/remember-me-hooks-legacy.DgWrhCuJ.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-useUnauthenticatedErrorModal-legacy.DPtC59lX.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-useShowCreateMoreAccountsGdprTreatment-legacy.f8obeVne.js","/cdn/shopifycloud/checkout-web/assets/c1/OffsitePaymentFailed-legacy.Vq05yqY5.js","/cdn/shopifycloud/checkout-web/assets/c1/CalloutHeader-legacy.DlO8ZpVw.js","/cdn/shopifycloud/checkout-web/assets/c1/SplitDeliveryMerchandiseContainer-legacy.DjdTarRh.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-useCheckoutProtocolDarkTheme-legacy.B-RNT1sT.js","/cdn/shopifycloud/checkout-web/assets/c1/ChangeCompanyLocationLink-legacy.Drjy8i93.js","/cdn/shopifycloud/checkout-web/assets/c1/WalletsSandbox-WalletSandbox-legacy.Cksf4K9n.js","/cdn/shopifycloud/checkout-web/assets/c1/BillingAddressForm-legacy.Jv2RTZjQ.js","/cdn/shopifycloud/checkout-web/assets/c1/PhoneField-legacy.cfTEp7Jc.js","/cdn/shopifycloud/checkout-web/assets/c1/images-flag-icon-legacy.Bfupgm8k.js","/cdn/shopifycloud/checkout-web/assets/c1/translations-helpers-legacy.BVWaVIIJ.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-usePostPurchase-legacy.CdEENZPj.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-useSuppressShopPayModalOnLoad-legacy.deZNQRQl.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-useCanChangeCompanyLocation-legacy.BvREMcUl.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-useForceShopPayUrl-legacy.be11cWGV.js","/cdn/shopifycloud/checkout-web/assets/c1/GooglePayButton-index-legacy.Cq2CbNvb.js","/cdn/shopifycloud/checkout-web/assets/c1/PendingShipping-legacy.BnHGq-Fb.js","/cdn/shopifycloud/checkout-web/assets/c1/CompactChoiceList-legacy.XyseD5sg.js","/cdn/shopifycloud/checkout-web/assets/c1/AutocompleteField-hooks-legacy.CF3Q__R9.js","/cdn/shopifycloud/checkout-web/assets/c1/LocalizationExtensionField-legacy.D9sM7il0.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-useShopPayPaymentRequiredMethod-legacy.GFeVG7mW.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-useUpdateCheckoutAddress-legacy.B7x6SKKY.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-useGeneralPaymentErrorMessage-legacy.7a5Tjq2K.js","/cdn/shopifycloud/checkout-web/assets/c1/PaymentLine-legacy.CSvjtXQs.js","/cdn/shopifycloud/checkout-web/assets/c1/PaymentIcon-legacy.B_Pj-sSH.js","/cdn/shopifycloud/checkout-web/assets/c1/useShopPayButtonClassName-legacy.D2bmlOz0.js","/cdn/shopifycloud/checkout-web/assets/c1/billing-address-hooks-legacy.CsUUIIJn.js","/cdn/shopifycloud/checkout-web/assets/c1/WalletLogo-legacy.CJzfpvf2.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-useShowShopPayOptin-legacy.BHJGoYfK.js","/cdn/shopifycloud/checkout-web/assets/c1/Section-legacy.BWxeWCuT.js","/cdn/shopifycloud/checkout-web/assets/c1/MobileOrderSummary-legacy.DarTDyDq.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-useOnePageFormSubmit-legacy.DrRYGkpj.js","/cdn/shopifycloud/checkout-web/assets/c1/PayPalOverCaptureInfoBanner-legacy.BhT98PFl.js","/cdn/shopifycloud/checkout-web/assets/c1/utilities-get-negotiation-input-legacy.BsHTZxoC.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-useShopCashCheckoutEligibility-legacy.moShegFD.js","/cdn/shopifycloud/checkout-web/assets/c1/redemption-constants-legacy.CxiN0GmP.js","/cdn/shopifycloud/checkout-web/assets/c1/BillingAddressSelector-legacy.CbQJXwiD.js","/cdn/shopifycloud/checkout-web/assets/c1/PaymentErrorBanner-legacy.qUv-nBaY.js","/cdn/shopifycloud/checkout-web/assets/c1/StockProblems-StockProblemsLineItemList-legacy.bKX58I82.js","/cdn/shopifycloud/checkout-web/assets/c1/DutyOptions-legacy.JXYmaBv1.js","/cdn/shopifycloud/checkout-web/assets/c1/ShipmentBreakdown-legacy.DnJaM_74.js","/cdn/shopifycloud/checkout-web/assets/c1/MerchandiseModal-legacy.mczrYp_d.js","/cdn/shopifycloud/checkout-web/assets/c1/extension-targets-shipping-options-legacy.DeQBqHFE.js","/cdn/shopifycloud/checkout-web/assets/c1/StackedMerchandisePreview-legacy.X2_Ex9hI.js","/cdn/shopifycloud/checkout-web/assets/c1/EstimatedDeliveryContent-legacy._arzwYMZ.js","/cdn/shopifycloud/checkout-web/assets/c1/ShippingMethodSelector-legacy.BmhYtFp0.js","/cdn/shopifycloud/checkout-web/assets/c1/TextArea-legacy.vhSJ0Txv.js","/cdn/shopifycloud/checkout-web/assets/c1/SubscriptionPriceBreakdown-legacy.CNtSAubP.js","/cdn/shopifycloud/checkout-web/assets/c1/hooks-usePaypalRowEffects-legacy.CmeA5hJo.js","/cdn/shopifycloud/checkout-web/assets/c1/Switch-legacy.BZmcd8O7.js","/cdn/shopifycloud/checkout-web/assets/c1/Middot-legacy.OtENofQt.js","/cdn/shopifycloud/checkout-web/assets/c1/ShippingGroupsSummaryLine-legacy.CW6CL7BI.js","/cdn/shopifycloud/checkout-web/assets/c1/utilities-publishMessage-legacy.BHLckSmf.js"];
      var styles = [];
      var fontPreconnectUrls = [];
      var fontPrefetchUrls = [];
      var imgPrefetchUrls = [];

      function preconnect(url, callback) {
        var link = document.createElement('link');
        link.rel = 'dns-prefetch preconnect';
        link.href = url;
        link.crossOrigin = '';
        link.onload = link.onerror = callback;
        document.head.appendChild(link);
      }

      function preconnectAssets() {
        var resources = preconnectOrigins.concat(fontPreconnectUrls);
        var index = 0;
        (function next() {
          var res = resources[index++];
          if (res) preconnect(res, next);
        })();
      }

      function prefetch(url, as, callback) {
        var link = document.createElement('link');
        if (link.relList.supports('prefetch')) {
          link.rel = 'prefetch';
          link.fetchPriority = 'low';
          link.as = as;
          if (as === 'font') link.type = 'font/woff2';
          link.href = url;
          link.crossOrigin = '';
          link.onload = link.onerror = callback;
          document.head.appendChild(link);
        } else {
          var xhr = new XMLHttpRequest();
          xhr.open('GET', url, true);
          xhr.onloadend = callback;
          xhr.send();
        }
      }

      function prefetchAssets() {
        var resources = [].concat(
          scripts.map(function(url) { return [url, 'script']; }),
          styles.map(function(url) { return [url, 'style']; }),
          fontPrefetchUrls.map(function(url) { return [url, 'font']; }),
          imgPrefetchUrls.map(function(url) { return [url, 'image']; })
        );
        var index = 0;
        function run() {
          var res = resources[index++];
          if (res) prefetch(res[0], res[1], next);
        }
        var next = (self.requestIdleCallback || setTimeout).bind(self, run);
        next();
      }

      function onLoaded() {
        try {
          if (parseFloat(navigator.connection.effectiveType) > 2 && !navigator.connection.saveData) {
            preconnectAssets();
            prefetchAssets();
          }
        } catch (e) {}
      }

      if (document.readyState === 'complete') {
        onLoaded();
      } else {
        addEventListener('load', onLoaded);
      }
    })();
  