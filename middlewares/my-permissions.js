exports.getMyPermissions = async (req, res) => {
    return res.json({
        success: true,
        data: req.permissions.permissions
    });
};
