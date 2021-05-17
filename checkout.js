/* eslint-disable */
let cardNumber;
const stripe = Stripe(publishable_key);

(() => {
  document
    .getElementById("submit-button")
    .addEventListener("click", convertCard);
  window.loaded = true;
})();

const changePurchaseText = () => {
  if (!user) {
    $(".purchase-btn").text("Log In");
    $(".purchase-btn").removeAttr("type");
    $(".purchase-btn").attr("id", "submit-login-button");
    $(".purchase-btn").addClass("login-btn");
    $(".purchase-btn").attr("onclick", "location.href='/auth/discord'");
  } else if ($(".bundle.selected").attr("free") === "true") {
    $(".purchase-btn").text("Join");
  } else if (subscribed === "true") {
    $(".purchase-btn").text("Upgrade");
  } else {
    $(".purchase-btn").text("Purchase");
  }
};

const sendRequest = async (endpoint, body, retries, timeout) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.post(endpoint, body);
      return response;
    } catch (e) {
      if (e.response.status !== 503) throw new Error(e.response.data);
    }

    /* set a timeout */
    await (() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, timeout);
      });
    })();
    console.log(`Attempting ${endpoint}: Try #${i}...`);
  }
  throw new Error("Request to backend timed out... Please try again later.");
};

const setupCard = async (card) => {
  let secret, customer;

  const setupResponse = await sendRequest(
    "/checkout/enforce-payments",
    {
      bundle: document.getElementById("bundle").value,
      fullName: document.getElementById("fullName").value,
      email: document.getElementById("email").value,
      coupon: document.getElementById("coupon").value,
      country: document.getElementById("country").value,
    },
    10,
    1000
  );

  if (!setupResponse.data.success) throw new Error(setupResponse.data.message);

  customer = setupResponse.data.customer;
  secret = setupResponse.data.si;

  /* don't even try buddy LOL */
  if (setupResponse.data.free) {
    return {
      customer,
      free: true,
    };
  }

  const result = await stripe.confirmCardSetup(secret, {
    payment_method: {
      card,
      billing_details: {
        name: document.getElementById("fullName").value,
        email: document.getElementById("email").value,
      },
    },
  });

  if (result.error) throw new Error(result.error.message);

  return {
    needsIntent: setupResponse.data.needsIntent,
    result,
    customer,
    free: false,
  };
};

const intent = async (si) => {
  let cpi = null;

  const intentResponse = await sendRequest(
    "/checkout/generate-intents",
    {
      customer: si.customer,
      payment_method: si.result.setupIntent.payment_method,
      needsIntent: si.needsIntent,
      coupon: document.getElementById("coupon").value,
    },
    10,
    1000
  );

  if (!intentResponse.data.success)
    throw new Error(intentResponse.data.message);

  if (intentResponse.data.cpi) {
    cpi = await stripe.confirmCardPayment(intentResponse.data.cpi, {
      payment_method: si.result.setupIntent.payment_method,
    });
    if (cpi.error) throw new Error(cpi.error.message);
  }

  return cpi;
};

async function convertCard(e) {
  const submitButton = document.getElementById("submit-button");
  try {
    e.preventDefault();
    submitButton.disabled = true;
    $("#submit-button").addClass("btn-in-progress");

    const si = await setupCard(cardNumber); // { result, customer }
    const cpi = si.free ? null : await intent(si);

    console.log({
      customer: si.customer,
      cpi: cpi ? cpi.paymentIntent.id : null,
    });

    await sendRequest(
      "/stripe/checkout",
      {
        ...$("#checkout-form")
          .serializeArray()
          .reduce(function (a, x) {
            a[x.name] = x.value;
            return a;
          }, {}),
        customer: si.customer,
        cpi: cpi ? cpi.paymentIntent.id : null,
      },
      10,
      1000
    );

    window.location.replace("/dashboard/activate");
  } catch (e) {
    submitButton.disabled = false;
    changePurchaseText();
    $("#submit-button").removeClass("btn-in-progress");
    window.FlashMessage.error(e.message, {
      progress: true,
      interactive: true,
      timeout: 6000,
      appear_delay: 200,
      container: ".flash-container",
      theme: "dark",
    });
  }
}
