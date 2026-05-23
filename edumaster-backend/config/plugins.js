module.exports = () => ({
    // Disable i18n plugin entirely - this is a Vietnamese-only app
    i18n: {
        enabled: false,
    },
    'users-permissions': {
        config: {
            ratelimit: {
                interval: 60000,
                max: 100,
            },
        },
    },
});
