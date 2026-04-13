(function () {
  const buttons = Array.from(document.querySelectorAll("[data-service-cta]"));
  const statusBox = document.getElementById("service-status");

  if (!buttons.length || !statusBox) {
    return;
  }

  const serviceCatalog = new Map();
  const originalLabels = new Map();

  buttons.forEach((button) => {
    originalLabels.set(button, button.textContent.trim());
  });

  function setStatus(message, tone) {
    statusBox.hidden = false;
    statusBox.dataset.tone = tone || "info";
    statusBox.textContent = message;
  }

  function clearStatus() {
    statusBox.hidden = true;
    statusBox.textContent = "";
    statusBox.dataset.tone = "info";
  }

  function setButtonLoading(button, isLoading) {
    const loadingLabel = button.dataset.loadingLabel || "Opening Checkout...";
    const originalLabel = originalLabels.get(button) || button.textContent.trim();

    button.classList.toggle("is-loading", isLoading);
    button.setAttribute("aria-busy", String(isLoading));
    button.textContent = isLoading ? loadingLabel : originalLabel;
  }

  function convertToFallback(button, fallbackLabel) {
    button.dataset.serviceAction = "quote";
    button.classList.add("is-disabled");

    if (fallbackLabel) {
      button.textContent = fallbackLabel;
      originalLabels.set(button, fallbackLabel);
    }
  }

  function openFallback(button, notice) {
    if (notice) {
      setStatus(notice, "info");
    }

    const fallbackUrl = button.dataset.quoteUrl || "#contact";

    if (fallbackUrl.startsWith("mailto:")) {
      window.location.href = fallbackUrl;
      return;
    }

    const target = document.querySelector(fallbackUrl);

    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    window.location.href = fallbackUrl;
  }

  function hydrateFromQueryString() {
    const url = new URL(window.location.href);
    const checkoutState = url.searchParams.get("checkout");
    const serviceSlug = url.searchParams.get("service");

    if (!checkoutState) {
      return;
    }

    const serviceName =
      serviceCatalog.get(serviceSlug)?.name ||
      buttons.find((button) => button.dataset.serviceCta === serviceSlug)?.dataset.serviceName ||
      "your selected service";

    if (checkoutState === "success") {
      setStatus(
        `Stripe checkout completed for ${serviceName}. We will follow up privately to confirm the next step.`,
        "success",
      );
    } else if (checkoutState === "cancel") {
      setStatus(
        `Stripe checkout for ${serviceName} was canceled. You can retry anytime or request a private consultation instead.`,
        "error",
      );
    }

    url.searchParams.delete("checkout");
    url.searchParams.delete("service");
    url.searchParams.delete("session_id");
    window.history.replaceState({}, document.title, url.pathname + url.search);
  }

  async function loadCatalog() {
    try {
      const response = await fetch("/api/stripe/catalog", {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(`catalog_request_failed_${response.status}`);
      }

      const payload = await response.json();

      (payload.services || []).forEach((service) => {
        serviceCatalog.set(service.slug, service);
      });

      buttons.forEach((button) => {
        const service = serviceCatalog.get(button.dataset.serviceCta);

        if (!service) {
          return;
        }

        button.dataset.quoteUrl = service.contactUrl || button.dataset.quoteUrl || "#contact";

        if (button.dataset.serviceAction === "stripe" && !service.checkoutEnabled) {
          convertToFallback(button, service.fallbackCta);
        }
      });
    } catch (error) {
      buttons.forEach((button) => {
        if (button.dataset.serviceAction === "stripe") {
          convertToFallback(button, "Request Consultation");
        }
      });
    } finally {
      hydrateFromQueryString();
    }
  }

  async function startCheckout(button) {
    const serviceSlug = button.dataset.serviceCta;

    if (!serviceSlug) {
      return;
    }

    setButtonLoading(button, true);
    clearStatus();

    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ serviceSlug }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (payload.contactUrl) {
          convertToFallback(button, "Request Consultation");
          openFallback(
            button,
            "This offer is currently handled through a private consultation. We have opened the direct contact route for you.",
          );
          return;
        }

        throw new Error(payload.error || "Unable to start secure checkout right now.");
      }

      if (!payload.url) {
        throw new Error("checkout_url_missing");
      }

      window.location.assign(payload.url);
    } catch (error) {
      const fallbackMessage =
        "Secure checkout is not available from this environment yet. Please use the private consultation route for now.";

      convertToFallback(button, "Request Consultation");
      openFallback(
        button,
        error instanceof Error && error.message ? error.message : fallbackMessage,
      );
    } finally {
      setButtonLoading(button, false);
    }
  }

  buttons.forEach((button) => {
    button.addEventListener("click", (event) => {
      const action = button.dataset.serviceAction;

      if (action === "quote") {
        event.preventDefault();
        openFallback(button);
        return;
      }

      if (action === "stripe") {
        event.preventDefault();
        startCheckout(button);
      }
    });
  });

  loadCatalog();
})();
