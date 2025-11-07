<!DOCTYPE html>
<html>
<head>
    <title>Cache Test</title>
</head>
<body>
    <h1>Cache Test Page</h1>
    <p>Timestamp: <?php echo time(); ?></p>
    <p>If the timestamp above changes on refresh, caching is not the issue.</p>
    <script>
        alert("TEST PAGE LOADED - Timestamp: " + new Date().getTime());
        console.log("%c🔴 TEST PAGE ACTIVE - " + new Date(), "background: red; color: white; font-size: 20px; padding: 10px;");
    </script>
</body>
</html>
