$(document).ready(() => {
    document
        .getElementById('coupon')
        .addEventListener('change', async function (e) {
            try {
                const resp = await axios.get(
                    `/validateCoupon?coupon=${e.target.value}`
                );
                console.log(resp.data);
                window.FlashMessage.success(
                    `${resp.data.percent_off}% off coupon applied to checkout.`,
                    {
                        progress: true,
                        interactive: true,
                        timeout: 6000,
                        appear_delay: 200,
                        container: '.flash-container',
                        theme: 'default'
                    }
                );
            } catch (e) {
                window.FlashMessage.error('Invalid coupon code.', {
                    progress: true,
                    interactive: true,
                    timeout: 6000,
                    appear_delay: 200,
                    container: '.flash-container',
                    theme: 'default'
                });
            }
        });
});
