<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <title>Peta Jaringan</title>

    <link href="/vendor/fontawesome-free/css/all.min.css" rel="stylesheet" type="text/css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link href="/css/sb-admin-2.min.css" rel="stylesheet">
  <link href="/css/dashboard-modern.css" rel="stylesheet">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
    <link href="https://cdn.jsdelivr.net/npm/select2@4.10-rc.0/dist/css/select2.min.css" rel="stylesheet" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/select2-bootstrap-theme/0.1.0-beta.10/select2-bootstrap.min.css" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet.fullscreen/1.6.0/Control.FullScreen.min.css" integrity="sha512-3XoEL6+UmCIFrR3NIPfUTyRLS42+oL4cHNHQMD3P82P8y90cB6xIVmJ0jF118jKCXKiQzKj9890Lz5XG7B0NUA==" crossorigin="anonymous" referrerpolicy="no-referrer" />

    <style>
        /* Map-specific styles only - let sb-admin-2.css handle the layout */
        #content { 
            flex-grow: 1; 
            display: flex; 
            flex-direction: column; 
            overflow: hidden; 
        }
        
        #content .container-fluid {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            padding: 1rem;
            overflow: hidden;
        }
        
        /* Mobile optimizations for container */
        @media (max-width: 768px) {
            #content .container-fluid {
                padding: 0.5rem !important;
                width: 100%;
            }
            
            .navbar.topbar.mb-2 {
                margin-bottom: 0 !important;
            }
            
            /* Fix untuk modal yang terpotong di mobile */
            .modal-dialog {
                margin: 0.5rem;
                max-width: calc(100% - 1rem);
            }
            
            .modal-body {
                max-height: calc(100vh - 150px);
                padding: 0.75rem;
            }
        }
        #mapContainer {
            position: relative;
            width: 100%;
            flex-grow: 1;
            min-height: 400px;
            border-radius: .35rem;
            box-shadow: 0 .15rem 1.75rem 0 rgba(58,59,69,.15)!important;
            overflow: hidden;
        }
        #interactiveMap {
            width: 100%;
            height: 100%;
            border-radius: .35rem;
        }

        #mapContainer:-webkit-full-screen { width: 100vw; height: 100vh; padding: 0; margin: 0; background-color: #fff; }
        #mapContainer:-moz-full-screen { width: 100vw; height: 100vh; padding: 0; margin: 0; background-color: #fff; }
        #mapContainer:-ms-fullscreen { width: 100vw; height: 100vh; padding: 0; margin: 0; background-color: #fff; }
        #mapContainer:fullscreen { width: 100vw; height: 100vh; padding: 0; margin: 0; background-color: #fff; }

        #mapContainer:-webkit-full-screen #interactiveMap,
        #mapContainer:-moz-full-screen #interactiveMap,
        #mapContainer:-ms-fullscreen #interactiveMap,
        #mapContainer:fullscreen #interactiveMap {
            height: 100% !important;
            width: 100% !important;
            min-height: 100% !important;
            border-radius: 0;
        }

        body:has(#mapContainer:fullscreen) #accordionSidebar,
        body:has(#mapContainer:fullscreen) .navbar,
        body:has(#mapContainer:fullscreen) .sticky-footer,
        body:has(#mapContainer:fullscreen) .map-instructions-header,
        body:has(#mapContainer:fullscreen) #globalMessageMap,
        body:has(#mapContainer:fullscreen) .scroll-to-top,
        body:has(#mapContainer:fullscreen) .h4.mb-0.text-gray-800.d-none.d-md-inline-block
        {
            display: none !important;
        }
         body:has(#mapContainer:fullscreen) #content-wrapper {
            padding: 0 !important;
            margin: 0 !important;
            height: 100vh;
         }
         body:has(#mapContainer:fullscreen) #content {
            height: 100vh;
         }
         body:has(#mapContainer:fullscreen) .container-fluid {
            padding: 0 !important;
            height: 100%;
         }

        .leaflet-popup-content-wrapper { border-radius: 5px; }
        .leaflet-popup-content { font-size: 0.9rem; line-height: 1.4; max-width: 380px !important; }
        .leaflet-popup-content b { color: #4e73df; display: block; margin-bottom: 3px; }
        .leaflet-popup-content p { margin: 4px 0; font-size: 0.85rem; word-wrap: break-word; }
        .leaflet-popup-content button { margin-top: 8px; margin-right: 5px;}
        
        .legend { padding: 6px 8px; font: 14px/16px Arial, Helvetica, sans-serif; background: white; background: rgba(255,255,255,0.9); box-shadow: 0 0 15px rgba(0,0,0,0.2); border-radius: 5px; line-height: 24px; color: #555; max-width: 250px;}
        .legend i {
            vertical-align: middle;
            margin-right: 8px;
            font-size: 18px;
        }
        .legend span > i {
             text-shadow: 1px 1px 3px rgba(0,0,0,0.2);
        }
         .legend hr {
            margin-top: 8px;
            margin-bottom: 8px;
            border: 0;
            border-top: 1px solid #ccc;
        }

        .select2-container .select2-selection--single { height: calc(1.5em + .75rem + 2px)!important; padding: .375rem .75rem!important; line-height: 1.5; }
        .select2-container--bootstrap .select2-selection--single .select2-selection__rendered { line-height: calc(1.5em + .75rem)!important; padding-left: 0 !important; }
        .select2-container--bootstrap .select2-selection--single .select2-selection__arrow { height: calc(1.5em + .75rem + 2px)!important; }

        .map-instructions-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            background-color: #f8f9fc;
            border: 1px solid #e3e6f0;
            border-radius: .35rem;
            margin-bottom: 15px;
            font-size: 0.9em;
            flex-wrap: wrap;
        }

        .modal-body { max-height: calc(100vh - 210px); overflow-y: auto; }
        .modal-lg { max-width: 800px; }
        .modal-xl { max-width: 1140px; }

        .form-label { margin-bottom: .3rem; font-size: 0.8rem; font-weight: 500; }
        .form-control-sm { font-size: 0.8rem; padding: .25rem .5rem; height: calc(1.5em + .5rem + 2px); }

        #manualFullscreenBtn {
            position: absolute;
            bottom: 10px;
            left: 10px;
            z-index: 1000;
            padding: 6px 10px;
        }
        #mapContainer:fullscreen #manualFullscreenBtn,
        #mapContainer:-webkit-full-screen #manualFullscreenBtn,
        #mapContainer:-moz-full-screen #manualFullscreenBtn,
        #mapContainer:-ms-fullscreen #manualFullscreenBtn {
            bottom: 15px;
            left: 15px;
        }

        #wifiInfoModalBody .card-header { background-color: #f8f9fc; font-size: 0.9rem; padding: 0.5rem 1rem;}
        #wifiInfoModalBody .card-body { font-size: 0.85rem; padding: 0.75rem;}
        #wifiInfoModalBody .list-group-item { border-left:0; border-right:0; padding-left:0; padding-right:0; font-size: 0.8rem; }
        #wifiInfoModalBody .device-list { padding-left: 1.25rem; }
        #wifiInfoModalBody .small {font-size: 0.8em;}
         #wifi-names-container div { margin-bottom: 2px; }


        /* Simplified .leaflet-div-icon and .custom-div-icon CSS */
        .leaflet-div-icon {
            background: transparent !important;
            border: none !important;
            text-align: center;
        }
        .custom-div-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
        }
        .custom-div-icon i {
            font-size: 24px;
            text-shadow: 1px 1px 3px rgba(0,0,0,0.3);
            display: block;
            line-height: 1;
        }
        /* Label styling, this will now apply to the L.tooltip content */
        .leaflet-tooltip.leaflet-tooltip-bottom.marker-label-tooltip {
            background-color: rgba(255, 255, 255, 0.75);
            color: black;
            font-size: 11px;
            font-weight: bold;
            padding: 1px 4px;
            border-radius: 3px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.2);
            white-space: nowrap;
            /* Remove default Leaflet tooltip arrow */
            border: none;
        }
        .leaflet-tooltip.leaflet-tooltip-bottom.marker-label-tooltip::before {
            border-bottom-color: transparent !important; /* Hide arrow */
        }


        .icon-odc i { color: #8A2BE2; }
        .icon-odp i { color: #FFA500; }
        .icon-customer-online i { color: #28a745 !important; }
        .icon-customer-offline i { color: #dc3545 !important; }
        .icon-customer-unknown i { color: #007bff !important; }

        .leaflet-control-custom-gps {
            background-color: white;
            border: 2px solid rgba(0,0,0,0.2);
            border-radius: 4px;
            width: 34px;
            height: 34px;
            line-height: 30px;
            text-align: center;
            cursor: pointer;
        }
        .leaflet-control-custom-gps i {
            font-size: 16px;
            color: #007bff;
        }
        .leaflet-control-custom-gps:hover {
            background-color: #f4f4f4;
        }
        
        /* Fix untuk overlap controls di mobile */
        @media (max-width: 768px) {
            .leaflet-control-custom-gps {
                width: 30px;
                height: 30px;
                line-height: 26px;
            }
            .leaflet-control-custom-gps i {
                font-size: 14px;
            }
            .leaflet-control-zoom {
                margin-top: 10px !important;
            }
            .leaflet-control-layers {
                margin-right: 5px !important;
            }
            #manualFullscreenBtn {
                bottom: 5px;
                left: 5px;
                padding: 4px 8px;
                font-size: 0.85rem;
            }
            
            /* Ensure map uses full available space */
            #interactiveMap {
                height: 100% !important;
            }
        }
        
        /* Styling for custom label toggles inside the layer control */
        .leaflet-control-layers-separator {
            border-top: 1px solid #ddd;
            margin: 5px 0;
        }
        .label-toggle-section {
            padding: 2px 5px;
        }
        .label-toggle-section label {
            display: flex;
            align-items: center;
            font-weight: normal;
            cursor: pointer;
        }
         .label-toggle-section label span {
            padding-left: 4px;
         }
        
        /* Collapsible Legend Styling */
        .legend-control {
            box-shadow: 0 1px 5px rgba(0,0,0,0.4);
            background: #fff;
            border-radius: 5px;
        }
        .legend-control a.legend-toggle {
            display: block;
            width: 36px;
            height: 36px;
            line-height: 36px;
            text-align: center;
            cursor: pointer;
            color: #333;
        }
        .legend-control a.legend-toggle i {
            font-size: 1.2em;
        }
        .legend-control.legend-collapsed .info.legend { display: none; }
        .legend-control:not(.legend-collapsed) a.legend-toggle { display: none; }
        .legend-control .info.legend { cursor: pointer; }


        #refreshAllDataBtn {
            margin-bottom: 0px;
        }
        #openCustomFilterModalBtn {
            margin-left: 10px;
        }
        
        /* Fix untuk auto refresh checkbox */
        .form-check.form-check-inline {
            white-space: nowrap;
        }
        .filter-list-column {
            max-height: 50vh;
            overflow-y: auto;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: .25rem;
        }
        
        @media (max-width: 768px) {
            .filter-list-column {
                max-height: 30vh;
            }
        }
        .filter-list-column .list-group-item {
            padding: .5rem .75rem;
            font-size: 0.85rem;
        }
        .filter-list-column .list-group-item label {
            margin-bottom: 0;
            font-weight: normal;
            width: 100%;
            cursor: pointer;
        }
         .filter-list-column .list-group-item input[type="checkbox"] {
            margin-right: 8px;
        }
        .filter-search-input {
            margin-bottom: 10px;
        }

        /* Asset Modal Map */
        #assetModalMap {
            height: 250px;
            width: 100%;
            margin-bottom: 10px;
            border: 1px solid #ddd;
            border-radius: .35rem;
        }
        /* Style for Leaflet layer control in asset modal */
        #assetModal .leaflet-control-layers {
            font-size: 0.8rem;
        }
        #assetModal .leaflet-control-layers-expanded {
             padding: 6px 10px 6px 6px;
        }


        /* Mobile Responsiveness Improvements */
@media (max-width: 768px) {
    #content .container-fluid {
        padding: 0.5rem !important;
        height: calc(100vh - 60px);
    }
    
    #mapContainer {
        height: calc(100vh - 80px) !important;
        border-radius: 0;
        margin: 0;
        width: 100%;
    }
    
    .map-controls-container {
        bottom: 80px !important;
    }
    
    /* Remove this duplicate rule as it conflicts with responsive layout */
    
    .map-instructions-header {
        display: none !important; /* Hide instruction header on mobile to maximize map space */
    }
    
    /* Floating action buttons for mobile */
    #openCustomFilterModalBtn,
    #refreshAllDataBtn {
        position: fixed !important;
        z-index: 999;
        border-radius: 50% !important;
        width: 45px !important;
        height: 45px !important;
        padding: 0 !important;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
    }
    
    #openCustomFilterModalBtn {
        bottom: 140px !important;
        right: 15px !important;
        margin: 0 !important;
    }
    
    #refreshAllDataBtn {
        bottom: 85px !important;
        right: 15px !important;
        margin: 0 !important;
    }
    
    #openCustomFilterModalBtn span,
    #refreshAllDataBtn span {
        display: none !important;
    }
    
    /* Auto refresh checkbox mobile position */
    .form-check.form-check-inline {
        position: fixed !important;
        bottom: 195px !important;
        right: 15px !important;
        background: white !important;
        padding: 5px 10px !important;
        border-radius: 20px !important;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3) !important;
        margin: 0 !important;
        z-index: 999;
    }
    
    .form-check.form-check-inline label {
        font-size: 0.75rem !important;
        margin-bottom: 0 !important;
    }

    .h4.mb-0.text-gray-800.d-none.d-md-inline-block {
        font-size: 1.1rem;
    }
    
    .legend-control, .legend {
        max-width: 180px;
        font-size: 12px;
        line-height: 20px;
    }
    
    .legend i {
        font-size: 14px;
    }
    
    /* Custom Filter Modal Spacing on Mobile */
    #customFilterModal .col-md-4 {
        margin-bottom: 1.5rem;
    }
    
    #customFilterModal .col-md-4:last-child {
        margin-bottom: 0;
    }
}
        
        /* Responsif untuk tablet */
        @media (min-width: 769px) and (max-width: 1024px) {
            #mapContainer {
                height: calc(100vh - 160px);
            }
            
            .navbar.topbar {
                padding: 0.5rem 1rem !important;
            }
            
            .navbar.topbar .h4 {
                font-size: 1.1rem !important;
            }
        }
        @media (max-width: 575.98px) {
            #content .container-fluid {
                padding: 0.25rem;
            }
            
            #mapContainer {
                height: calc(100vh - 70px) !important;
            }
            
            .map-instructions-header {
                padding: 6px;
                font-size: 0.8rem;
            }
            
            .map-instructions-header > span {
                font-size: 0.8rem;
            }
            
            .map-instructions-header .btn {
                font-size: 0.8rem;
                padding: 0.25rem 0.5rem;
            }
            
            .legend-control {
                display: none;
            }
            
            /* Auto refresh checkbox handled by floating position above */
            
            .form-check-label {
                font-size: 0.85rem;
            }
            
            /* Compact navbar for small screens */
            .navbar.topbar {
                padding: 0.375rem 0.75rem !important;
            }
            
            #username-placeholder {
                display: none !important;
            }
        }

    </style>
    <!-- Mobile sidebar styles handled by sb-admin-2.css -->
</head>

<body id="page-top">
    <div id="wrapper">
        <?php include '_navbar.php'; ?>
        <div id="content-wrapper" class="d-flex flex-column">
            <div id="content">
                <nav class="navbar navbar-expand navbar-light bg-white topbar mb-2 static-top shadow">
                    <button type="button" id="sidebarToggleTop" class="btn btn-link d-md-none rounded-circle mr-3"><i class="fa fa-bars"></i></button>
                    <h1 class="h4 mb-0 text-gray-800">Peta Aset Jaringan</h1>
                    <ul class="navbar-nav ml-auto">
                        <li class="nav-item dropdown no-arrow">
                            <a class="nav-link dropdown-toggle" href="#" id="userDropdown" role="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                <span id="username-placeholder" class="mr-2 d-none d-lg-inline text-gray-600 small">User</span>
                                <img class="img-profile rounded-circle" src="/img/undraw_profile.svg">
                            </a>
                            <div class="dropdown-menu dropdown-menu-right shadow animated--grow-in" aria-labelledby="userDropdown">
                                <a class="dropdown-item" href="/logout" data-toggle="modal" data-target="#logoutModal"><i class="fas fa-sign-out-alt fa-sm fa-fw mr-2 text-gray-400"></i>Logout</a>
                            </div>
                        </li>
                    </ul>
                </nav>
                <div class="container-fluid">
                    <div class="map-instructions-header">
                        <span class="flex-grow-1">
                           <i class="fas fa-info-circle"></i> <strong class="d-none d-sm-inline">Petunjuk:</strong> <span class="d-none d-md-inline">Klik marker ODC/ODP/Pelanggan untuk melihat detail atau mengelola. Gunakan tombol <i class="fas fa-crosshairs"></i> untuk ke lokasi GPS Anda.</span><span class="d-inline d-md-none">Klik marker untuk detail.</span>
                        </span>
                        <button id="openCustomFilterModalBtn" class="btn btn-sm btn-info" title="Filter Item Peta Secara Spesifik">
                            <i class="fas fa-filter"></i> <span class="d-none d-sm-inline">Filter Kustom</span><span class="d-inline d-sm-none">Filter</span>
                        </button>
                        <button id="refreshAllDataBtn" class="btn btn-sm btn-primary ml-2" title="Refresh Status Pelanggan & Redaman">
                            <i class="fas fa-sync-alt"></i> <span class="d-none d-sm-inline">Refresh Data</span><span class="d-inline d-sm-none">Refresh</span>
                        </button>
                        <div class="form-check form-check-inline ml-3">
                            <input class="form-check-input" type="checkbox" id="autoRefreshToggle">
                            <label class="form-check-label" for="autoRefreshToggle" title="Aktifkan refresh data otomatis setiap 30 detik">
                                <span class="d-none d-sm-inline">Auto Refresh</span><span class="d-inline d-sm-none">Auto</span>
                            </label>
                        </div>
                    </div>
                    <div id="globalMessageMap" class="mb-2"></div>
                    <div id="mapContainer">
                        <button id="manualFullscreenBtn" class="btn btn-light btn-sm" title="Layar Penuh Peta (Kustom)">
                            <i class="fas fa-expand"></i>
                        </button>
                        <div id="interactiveMap"></div>
                    </div>
                </div>
            </div>
            <footer class="sticky-footer bg-white">
                <div class="container my-auto"><div class="copyright text-center my-auto"><span>Copyright &copy; RAF BOT 2025</span></div></div>
            </footer>
        </div>
    </div>

    <a class="scroll-to-top rounded" href="#page-top"><i class="fas fa-angle-up"></i></a>
    <div class="modal fade" id="logoutModal" tabindex="-1" role="dialog"><div class="modal-dialog modal-dialog-centered" role="document"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Ready to Leave?</h5><button class="close" type="button" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button></div><div class="modal-body">Select "Logout" below if you are ready to end your current session.</div><div class="modal-footer"><button class="btn btn-secondary" type="button" data-dismiss="modal">Cancel</button><a class="btn btn-primary" href="/logout">Logout</a></div></div></div></div>

    <div class="modal fade" id="assetModal" tabindex="-1" role="dialog" aria-labelledby="assetModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-lg" role="document">
            <form id="assetForm">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="assetModalLabel">Tambah Aset Jaringan Baru</h5>
                        <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="assetId">
                        <div class="row">
                            <div class="col-md-6">
                                <div class="form-group">
                                    <label for="assetType" class="form-label">Tipe Aset <span class="text-danger">*</span></label>
                                    <select class="form-control form-control-sm" id="assetType" name="type" required>
                                        <option value="ODC">ODC (Optical Distribution Cabinet)</option>
                                        <option value="ODP">ODP (Optical Distribution Point)</option>
                                    </select>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="form-group">
                                    <label for="assetName" class="form-label">Nama/Label Aset <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control form-control-sm" id="assetName" name="name" placeholder="Contoh: ODC Kaliasin 01" required>
                                </div>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="assetAddress" class="form-label">Alamat/Lokasi Detail</label>
                            <input type="text" class="form-control form-control-sm" id="assetAddress" name="address" placeholder="Contoh: Jl. Kaliasin No. 1, Surabaya">
                        </div>
                        <div class="row">
                            <div class="col-md-6">
                                <div class="form-group">
                                    <label for="assetLatitude" class="form-label">Latitude <span class="text-danger">*</span></label>
                                    <input type="number" step="any" class="form-control form-control-sm" id="assetLatitude" name="latitude" required>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="form-group">
                                    <label for="assetLongitude" class="form-label">Longitude <span class="text-danger">*</span></label>
                                    <input type="number" step="any" class="form-control form-control-sm" id="assetLongitude" name="longitude" required>
                                </div>
                            </div>
                        </div>
                        <div id="assetModalMap" style="height: 250px; width: 100%; margin-bottom: 15px; border: 1px solid #ddd; border-radius: .35rem;"></div>
                        <small class="form-text text-muted mb-2">Klik peta untuk menandai lokasi atau gunakan tombol GPS <i class="fas fa-map-marker-alt"></i>.</small>

                        <div class="form-group" id="parentOdcGroup" style="display:none;">
                            <label for="assetParentOdc" class="form-label">Induk ODC (untuk ODP)</label>
                            <select class="form-control form-control-sm" id="assetParentOdc" name="parent_odc_id" style="width: 100%;">
                                <option value="">-- Pilih ODC Induk --</option>
                            </select>
                            <div class="form-check mt-1">
                                <input class="form-check-input" type="checkbox" id="useParentOdcLocation">
                                <label class="form-check-label" for="useParentOdcLocation">
                                    Gunakan lokasi ODC Induk yang dipilih untuk ODP ini
                                </label>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-6">
                                <div class="form-group">
                                    <label for="assetCapacity" class="form-label">Kapasitas Port</label>
                                    <input type="number" class="form-control form-control-sm" id="assetCapacity" name="capacity_ports" placeholder="Contoh: 144 atau 8">
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="form-group">
                                    <label for="assetPortsUsed" class="form-label">Port Terpakai
                                        <span id="odcPortsUsedLabelInfo" style="display:none;"><small class="text-muted">(otomatis dari ODP)</small></span>
                                        <span id="odpPortsUsedLabelInfo" style="display:none;"><small class="text-muted">(otomatis dari pelanggan)</small></span>
                                    </label>
                                    <input type="number" class="form-control form-control-sm" id="assetPortsUsed" name="ports_used" placeholder="Otomatis" readonly>
                                </div>
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="assetNotes" class="form-label">Catatan Tambahan</label>
                            <textarea class="form-control form-control-sm" id="assetNotes" name="notes" rows="2" placeholder="Informasi tambahan mengenai aset..."></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-danger mr-auto" id="deleteAssetBtn" style="display:none;">Hapus Aset Ini</button>
                        <button type="button" class="btn btn-secondary btn-sm" data-dismiss="modal">Batal</button>
                        <button type="submit" class="btn btn-primary btn-sm" id="saveAssetBtn">Simpan Aset</button>
                    </div>
                </div>
            </form>
        </div>
    </div>

    <div class="modal fade" id="addOdpAfterOdcModal" tabindex="-1" role="dialog" aria-labelledby="addOdpAfterOdcModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="addOdpAfterOdcModalLabel">ODC Berhasil Disimpan</h5>
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                </div>
                <div class="modal-body">
                    <p id="addOdpAfterOdcMessageText"></p>
                    <p>Apakah Anda ingin menambahkan ODP di lokasi yang sama untuk ODC ini sekarang?</p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary btn-sm" data-dismiss="modal" id="noAddOdpBtn">Tidak, Lain Kali</button>
                    <button type="button" class="btn btn-primary btn-sm" id="yesAddOdpBtn">Ya, Tambah ODP</button>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade" id="wifiInfoModal" data-backdrop="static" tabindex="-1" role="dialog" aria-labelledby="wifiInfoModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-lg" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="wifiInfoModalLabel">Detail Informasi WiFi</h5>
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                </div>
                <div class="modal-body" id="wifiInfoModalBody" style="max-height: 75vh; overflow-y: auto;">
                    <p class="text-center my-3"><i class="fas fa-spinner fa-spin fa-2x"></i><br>Memuat informasi...</p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary btn-sm" data-dismiss="modal">Tutup</button>
                </div>
            </div>
        </div>
    </div>

    <div class="modal fade" id="wifiManagementModal" data-backdrop="static" tabindex="-1" role="dialog" aria-labelledby="wifiManagementModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered" role="document">
            <form id="wifiManagementForm">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="wifiManagementModalLabel">Kelola WiFi Pelanggan</h5>
                        <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                    </div>
                    <div class="modal-body">
                        <input type="hidden" id="wifi_manage_device_id" name="device_id_for_wifi_manage">
                        <input type="hidden" id="wifi_manage_customer_name" name="customer_name_for_wifi_manage">

                        <div id="wifiManagementFormContainer">
                            <p class="text-center"><i class="fas fa-spinner fa-spin"></i> Memuat detail WiFi...</p>
                        </div>
                         <div class="form-group mt-3">
                            <label for="wifi_manage_transmit_power" class="form-label">Transmit Power Global</label>
                            <select name="transmit_power" id="wifi_manage_transmit_power" class="form-control form-control-sm">
                                <option value="">-- Biarkan Default --</option>
                                <option value="20">20%</option>
                                <option value="40">40%</option>
                                <option value="60">60%</option>
                                <option value="80">80%</option>
                                <option value="100">100%</option>
                            </select>
                        </div>
                        <small class="form-text text-muted">Kosongkan field SSID atau Password jika tidak ingin mengubahnya. Password minimal 8 karakter.</small>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline-secondary btn-sm" data-dismiss="modal">Batal</button>
                        <button type="submit" class="btn btn-primary btn-sm" id="saveWifiManagementBtn">Simpan Perubahan WiFi</button>
                    </div>
                </div>
            </form>
        </div>
    </div>

    <div class="modal fade" id="customFilterModal" tabindex="-1" role="dialog" aria-labelledby="customFilterModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-xl" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="customFilterModalLabel">Filter Item Peta Kustom</h5>
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                </div>
                <div class="modal-body">
                    <div class="row">
                        <div class="col-md-4">
                            <h6><i class="fas fa-server"></i> Optical Distribution Cabinets (ODC)</h6>
                            <input type="text" class="form-control form-control-sm filter-search-input" id="searchOdcFilter" placeholder="Cari ODC...">
                            <div class="mb-2">
                                <input type="checkbox" id="selectAllOdc" class="mr-1">
                                <label for="selectAllOdc" class="small">Pilih Semua / Batal Pilih Semua ODC</label>
                            </div>
                            <ul class="list-group filter-list-column" id="odcFilterList">
                                </ul>
                        </div>
                        <div class="col-md-4">
                            <h6><i class="fas fa-network-wired"></i> Optical Distribution Points (ODP)</h6>
                            <input type="text" class="form-control form-control-sm filter-search-input" id="searchOdpFilter" placeholder="Cari ODP...">
                             <div class="mb-2">
                                <input type="checkbox" id="selectAllOdp" class="mr-1">
                                <label for="selectAllOdp" class="small">Pilih Semua / Batal Pilih Semua ODP</label>
                            </div>
                            <ul class="list-group filter-list-column" id="odpFilterList">
                                <li class="list-group-item text-muted small">Pilih ODC untuk melihat daftar ODP terkait.</li>
                            </ul>
                        </div>
                        <div class="col-md-4">
                            <h6><i class="fas fa-users"></i> Pelanggan</h6>
                             <input type="text" class="form-control form-control-sm filter-search-input" id="searchCustomerFilter" placeholder="Cari Pelanggan...">
                            <div class="mb-2">
                                <input type="checkbox" id="selectAllCustomer" class="mr-1">
                                <label for="selectAllCustomer" class="small">Pilih Semua / Batal Pilih Semua Pelanggan</label>
                            </div>
                            <ul class="list-group filter-list-column" id="customerFilterList">
                                <li class="list-group-item text-muted small">Pilih ODP untuk melihat daftar Pelanggan terkait.</li>
                            </ul>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-outline-secondary btn-sm" id="resetCustomFilterBtn">Reset ke Tampilkan Semua</button>
                    <button type="button" class="btn btn-secondary btn-sm" data-dismiss="modal">Batal</button>
                    <button type="button" class="btn btn-primary btn-sm" id="applyCustomFilterBtn">Terapkan Filter</button>
                </div>
            </div>
        </div>
    </div>


    <script src="/vendor/jquery/jquery.min.js"></script>
    <script src="/vendor/bootstrap/js/bootstrap.bundle.min.js"></script>
    <script src="/vendor/jquery-easing/jquery.easing.min.js"></script>
    <script src="/js/sb-admin-2.js"></script>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
    <script src="https://cdn.jsdelivr.net/npm/leaflet-ant-path@1.3.0/dist/leaflet-ant-path.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet.fullscreen/1.6.0/Control.FullScreen.min.js" integrity="sha512-b9oHc3mEAl85gS9gG3B1kF0D5iNqEjuKqSK_170oU92X4Wb8M7C2g4QyI2OGY/wUjSjHdXG/C0w9YmQAgw==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
    <script src="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js"></script>

    <script>
        if (window.location.protocol !== "https:" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
            console.warn("PERINGATAN: Halaman ini diakses melalui HTTP. Fitur geolokasi mungkin tidak berfungsi optimal. Silakan gunakan HTTPS.");
        }

        let currentUser = null;
        let map;
        let myLocationMarker = null;
        let networkMarkersLayer = L.layerGroup();
        let customerMarkersLayer = L.layerGroup();
        let linesLayer = L.layerGroup();

        let allOdcData = [];
        let allNetworkAssetsData = [];
        let allCustomerData = [];
        let activePppoeUsersMap = new Map();
        let initialPppoeLoadFailed = false;

        let odcMarkers = [];
        let odpMarkers = [];
        let customerMarkers = [];
        let odpToOdcLines = [];
        let customerToOdpLines = [];
        
        let labelVisibility = {
            odc: true,
            odp: true,
            customer: true
        };

        let selectedOdcIds = new Set();
        let selectedOdpIds = new Set();
        let selectedCustomerIds = new Set();
        let isInitialLoad = true;
        let autoRefreshIntervalId = null;
        const AUTO_REFRESH_INTERVAL_MS = 30000; // 30 detik

        // Mini-map specific variables
        let assetModalMapInstance = null;
        let assetModalMapMarker = null;

        const ICON_WIDTH = 30; // Standard width for our custom icons
        const ICON_HEIGHT = 24; // Standard height of FontAwesome icon (from font-size)
        // Note: For tooltips, their position is relative to the marker's anchor,
        // so we don't need to calculate label height into the main icon's size/anchor.

        /**
         * Creates a custom DivIcon with FontAwesome icon. This icon will NOT contain the label HTML.
         * The label will be handled by L.tooltip separately.
         * @param {string} faClassName - FontAwesome class (e.g., 'fa-server', 'fa-map-marker-alt').
         * @param {string} colorClass - Custom CSS class for color (e.g., 'icon-odc').
         * @returns {L.DivIcon} - A Leaflet DivIcon instance for the icon only.
         */
// Modifikasi createBaseIcon untuk menerima parameter anchor kustom
const createBaseIcon = (faClassName, colorClass, customAnchor = null) => {
    // Default anchor di tengah icon
    let iconAnchor = [ICON_WIDTH/2, ICON_HEIGHT/2];
    
    // Jika ada custom anchor, gunakan itu
    if (customAnchor) {
        iconAnchor = customAnchor;
    }
    
    return L.divIcon({
        html: `<div class="custom-div-icon ${colorClass}"><i class="fas ${faClassName}"></i></div>`,
        className: 'leaflet-div-icon',
        iconSize: [ICON_WIDTH, ICON_HEIGHT],
        iconAnchor: iconAnchor,
        popupAnchor: [0, -ICON_HEIGHT/2]
    });
};
        
const createAssetIcon = (asset) => {
    let iconClass, colorClass;
    if (asset.type === 'ODC') {
        iconClass = 'fa-server';
        colorClass = 'icon-odc';
    } else { // ODP
        iconClass = 'fa-network-wired';
        colorClass = 'icon-odp';
    }
    return createBaseIcon(iconClass, colorClass);
};

const myLocationIcon = createBaseIcon('fa-street-view', 'icon-customer-unknown'); 

const createCustomerStatusIcon = (status) => {
    let colorClass = 'icon-customer-unknown';
    if (status === 'online') {
        colorClass = 'icon-customer-online';
    } else if (status === 'offline') {
        colorClass = 'icon-customer-offline';
    }
    
    // Untuk icon marker, anchor harus di bagian bawah tengah
    // Nilai Y yang lebih besar berarti lebih ke bawah
    return createBaseIcon('fa-map-marker-alt', colorClass, [ICON_WIDTH/2, ICON_HEIGHT]);
};


        fetch('/api/me').then(response => response.json()).then(data => {
            if (data.status === 200 && data.data) {
                document.getElementById('username-placeholder').textContent = data.data.username;
                currentUser = data.data;
            }
          credentials: 'include', // ✅ Fixed by script
        }).catch(err => console.error("[MainScript] Error fetching user data:", err));

        function displayGlobalMapMessage(message, type = 'info', duration = 7000) {
            const globalMessageDiv = $('#globalMessageMap');
            globalMessageDiv.html(`<div class="alert alert-${type} alert-dismissible fade show" role="alert">
                                ${message}
                                <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                                    <span aria-hidden="true">&times;</span>
                                </button>
                            </div>`);
            if (duration > 0 && type !== 'danger' && type !== 'warning') {
                 setTimeout(() => {
                    globalMessageDiv.find('.alert').alert('close');
                }, duration);
            }
        }

        function handleGeolocationErrorMapViewer(error, contextMessage, displayTarget) {
            console.warn(`${contextMessage} - Error Code: ${error.code}, Message: ${error.message}`);
            let errorText = `<b>${contextMessage}</b><br/>`;
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorText += "IZIN LOKASI DITOLAK. Periksa pengaturan lokasi di OS & Browser Anda.";
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorText += "INFORMASI LOKASI TIDAK TERSEDIA. Pastikan GPS/Layanan Lokasi aktif.";
                    break;
                case error.TIMEOUT:
                    errorText += "WAKTU PERMINTAAN LOKASI HABIS. Sinyal mungkin lemah.";
                    break;
                default:
                    errorText += `Kesalahan (Code: ${error.code || 'N/A'}). Cek koneksi & HTTPS.`;
                    break;
            }
            displayTarget(errorText, 'danger', 15000);
        }

        function processSuccessfulGeolocationMapViewer(position, contextMessage, displayTarget, mapInstanceToUpdate, buttonContainer, originalIcon) {
            const userLat = position.coords.latitude;
            const userLng = position.coords.longitude;
            const accuracy = position.coords.accuracy;
            console.log(`${contextMessage} - Coords: Lat=${userLat}, Lng=${userLng}, Accuracy=${accuracy}m`);

            if (mapInstanceToUpdate) {
                mapInstanceToUpdate.setView([userLat, userLng], 17);
                if (myLocationMarker) {
                    myLocationMarker.setLatLng([userLat, userLng])
                                    .setTooltipContent(`Lokasi Saya (Akurasi: ${accuracy.toFixed(0)}m)`);
                } else {
                    myLocationMarker = L.marker([userLat, userLng], {icon: myLocationIcon, zIndexOffset: 1000})
                                         .bindTooltip(`Lokasi Saya (Akurasi: ${accuracy.toFixed(0)}m)`, {permanent: true, direction: 'top', className: 'marker-label-tooltip', offset: [0, -ICON_HEIGHT/2 - 5]}) // Offset to put label above icon
                                         .addTo(mapInstanceToUpdate);
                }
                // Ensure myLocationMarker tooltip is visible
                myLocationMarker.getTooltip().setOpacity(1); 
            }

            let accuracyMessage = `Lokasi GPS ditemukan (Akurasi: ${accuracy.toFixed(0)}m).`;
            let accuracyType = "success";
            if (accuracy > 1000) {
                accuracyMessage = `PERINGATAN: Akurasi lokasi sangat rendah (${Math.round(accuracy)}m). Mungkin lokasi jaringan/IP.`;
                accuracyType = "danger";
            } else if (accuracy > 150) {
                 accuracyMessage = `Info: Akurasi lokasi sedang (${Math.round(accuracy)}m).`;
                 accuracyType = "warning";
            }
            displayTarget(accuracyMessage, accuracyType, 10000);

            if (buttonContainer && originalIcon) {
                buttonContainer.innerHTML = originalIcon;
            }
        }


        function haversineDistance(coords1, coords2) {
            function toRad(x) { return x * Math.PI / 180; }
            const R = 6371;
            const dLat = toRad(coords2.latitude - coords1.latitude);
            const dLon = toRad(coords2.longitude - coords1.longitude);
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                      Math.cos(toRad(coords1.latitude)) * Math.cos(toRad(coords2.latitude)) *
                      Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c * 1000;
        }

        function getRedamanPresentation(redaman) {
            const val = parseFloat(redaman);
            let color = 'grey';
            let text;

            if (redaman === null || typeof redaman === 'undefined') {
                 text = 'RX: -';
                 color = '#6c757d';
            } else if (isNaN(val)) {
                text = 'RX: N/A';
                 color = '#6c757d';
            } else {
                 text = `RX: ${val.toFixed(2)} dBm`;
                 if (val > -20) color = '#28a745';
                 else if (val > -24) color = '#76ff03';
                 else if (val > -27) color = '#ffc107';
                 else if (val > -30) color = '#fd7e14';
                 else color = '#dc3545';
            }
            return { text, color };
        }

        async function updateCustomerPopupDetails(marker, customer) {
            const customerId = customer.id;
            const deviceId = customer.device_id;

            const modemTypeSpan = document.getElementById(`modem-type-${customerId}`);
            const redamanSpan = document.getElementById(`redaman-val-${customerId}`);

            if (!deviceId) {
                if (modemTypeSpan) modemTypeSpan.textContent = 'N/A (No Device ID)';
                if (redamanSpan) redamanSpan.innerHTML = getRedamanPresentation(null).text;
                return;
            }

            // Use the batch metrics API to get both redaman and modem type
            try {
                const response = await fetch('/api/customer-metrics-batch', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include', // ✅ Fixed by script
                    body: JSON.stringify({
                        deviceIds: [deviceId]
                    })
                });

                if (!response.ok) {
                    console.warn(`Failed to fetch metrics for ${deviceId}: ${response.status}`);
                    if (modemTypeSpan) modemTypeSpan.textContent = 'Tidak tersedia (Server Error)';
                    if (redamanSpan) {
                        const presentation = getRedamanPresentation('Error');
                        redamanSpan.innerHTML = `<span style="color: ${presentation.color}; font-weight: bold;">${presentation.text}</span>`;
                    }
                    return;
                }

                const result = await response.json();
                
                // API returns an array, find the device data by deviceId
                let deviceMetrics = null;
                if (result.status === 200 && Array.isArray(result.data)) {
                    deviceMetrics = result.data.find(metric => metric.deviceId === deviceId);
                }

                // Update modem type
                if (modemTypeSpan) {
                    if (deviceMetrics && deviceMetrics.modemType) {
                        modemTypeSpan.textContent = deviceMetrics.modemType;
                    } else {
                        modemTypeSpan.textContent = 'Tidak terdeteksi/N/A';
                    }
                }

                // Update redaman
                if (redamanSpan) {
                    let redamanValue = null;
                    if (deviceMetrics && deviceMetrics.redaman) {
                        // Remove the " dBm" suffix that's added by the API
                        redamanValue = deviceMetrics.redaman.replace(' dBm', '');
                    }
                    const presentation = getRedamanPresentation(redamanValue);
                    redamanSpan.innerHTML = `<span style="color: ${presentation.color}; font-weight: bold;">${presentation.text}</span>`;
                }

            } catch (error) {
                console.error(`Error fetching metrics for popup ${deviceId}:`, error);
                if (modemTypeSpan) modemTypeSpan.textContent = 'Error saat memuat';
                if (redamanSpan) {
                    const presentation = getRedamanPresentation('Error');
                    redamanSpan.innerHTML = `<span style="color: ${presentation.color}; font-weight: bold;">${presentation.text}</span>`;
                }
            }
        }


        async function fetchActivePppoeUsers() {
            initialPppoeLoadFailed = false;
            activePppoeUsersMap.clear();
            try {
                const response = await fetch(`/api/mikrotik/ppp-active-users?_=${new Date().getTime()}`);
                if (!response.ok) {
                    const errorResult = await response.json().catch(() => ({ message: response.statusText }));
                    console.error("[fetchActivePppoeUsers MapPage] API Error:", response.status, errorResult.message, errorResult.stderr || '');
                    displayGlobalMapMessage(`Gagal mengambil data PPPoE aktif: ${errorResult.message || response.statusText}. Status dan IP pelanggan mungkin tidak akurat.`, 'warning', 0);
                    initialPppoeLoadFailed = true;
                    return;
                }
                const result = await response.json();
                if (result.status === 200 && Array.isArray(result.data)) {
                    result.data.forEach(userEntry => {
                        if (userEntry.name && userEntry.address) {
                            activePppoeUsersMap.set(userEntry.name, userEntry.address);
                        } else {
                             console.warn("[fetchActivePppoeUsers MapPage] Entri pengguna dari API tidak lengkap:", userEntry);
                        }
                    });
                    console.log("Active PPPoE users and IPs fetched for Map Page:", activePppoeUsersMap.size);
                } else {
                    console.warn("[fetchActivePppoeUsers MapPage] Format data PPPoE aktif tidak sesuai atau status API bukan 200:", result);
                    displayGlobalMapMessage('Format data PPPoE aktif dari server tidak sesuai. Status dan IP pelanggan mungkin tidak akurat.', 'warning', 0);
                    initialPppoeLoadFailed = true;
                }
            } catch (error) {
                console.error("[fetchActivePppoeUsers MapPage] Error fetching active PPPoE data:", error);
                displayGlobalMapMessage('Kesalahan koneksi saat mengambil data PPPoE aktif. Status dan IP pelanggan mungkin tidak akurat.', 'danger', 0);
                initialPppoeLoadFailed = true;
            }
        }


        function initializeMap() {
            console.log("[InitializeMap] Memulai inisialisasi peta...");
            if (map) {
                console.warn("[InitializeMap] Menghapus instance peta sebelumnya.");
                try {
                    if (myLocationMarker) {
                        map.removeLayer(myLocationMarker);
                        myLocationMarker = null;
                    }
                    map.remove();
                } catch(e) { console.error("Error removing previous map instance:", e); }
                map = null;
            }
            try {
                const satelliteMaxZoom = 20;
                const osmMaxZoom = 22;

                map = L.map('interactiveMap', {
                    fullscreenControl: {
                        position: 'bottomleft',
                        title: 'Layar Penuh Peta (Plugin)',
                        titleCancel: 'Keluar Layar Penuh (Plugin)',
                        pseudoFullscreen: false
                    },
                    maxZoom: satelliteMaxZoom
                }).setView([-7.2430309,111.846867], 15);
                console.log("[InitializeMap] Objek peta berhasil dibuat.");

                const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: osmMaxZoom,
                    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                });
                const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    maxZoom: 20,
                    attribution: 'Tiles &copy; Esri'
                });
                satelliteLayer.addTo(map);

                networkMarkersLayer.addTo(map);
                customerMarkersLayer.addTo(map);
                linesLayer.addTo(map);

                const baseMaps = { "Satelit": satelliteLayer, "OpenStreetMap": osmLayer };
                const overlayMaps = {
                    "Aset Jaringan (ODC/ODP)": networkMarkersLayer,
                    "Pelanggan": customerMarkersLayer,
                    "Koneksi Antar Aset": linesLayer
                };
                
                const layersControl = L.control.layers(baseMaps, overlayMaps, {collapsed: true}).addTo(map);
                
                const layersControlContainer = layersControl.getContainer();
                // Initialize checkboxes based on current labelVisibility state
                const labelToggleHtml = `
                    <div class="leaflet-control-layers-separator"></div>
                    <div class="label-toggle-section">
                        <label><input type="checkbox" data-label-type="odc" class="leaflet-control-layers-selector" ${labelVisibility.odc ? 'checked' : ''}><span>Label ODC</span></label>
                        <label><input type="checkbox" data-label-type="odp" class="leaflet-control-layers-selector" ${labelVisibility.odp ? 'checked' : ''}><span>Label ODP</span></label>
                        <label><input type="checkbox" data-label-type="customer" class="leaflet-control-layers-selector" ${labelVisibility.customer ? 'checked' : ''}><span>Label Pelanggan</span></label>
                    </div>`;
                
                $(layersControlContainer).append(labelToggleHtml);
                
                L.DomEvent.on(layersControlContainer, 'click', function(e) {
                    if (e.target && e.target.dataset.labelType) {
                        L.DomEvent.stopPropagation(e);
                        const labelType = e.target.dataset.labelType;
                        const isChecked = e.target.checked;
                        labelVisibility[labelType] = isChecked;
                        redrawMarkers(labelType);
                    }
                });

                const GpsMapControl = L.Control.extend({
                    options: { position: 'topleft'},
                    onAdd: function(mapInstanceCtrl) {
                        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom-gps');
                        const iconHTML = '<i class="fas fa-crosshairs"></i>';
                        const loadingIconHTML = '<i class="fas fa-spinner fa-spin"></i>';
                        container.innerHTML = iconHTML;
                        container.title = 'Dapatkan Lokasi GPS Saat Ini';

                        L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation)
                            .on(container, 'click', L.DomEvent.preventDefault)
                            .on(container, 'click', function () {
                                container.innerHTML = loadingIconHTML;
                                displayGlobalMapMessage("Meminta lokasi GPS Anda...", "info", 3000);
                                if (navigator.geolocation) {
                                    navigator.geolocation.getCurrentPosition(
                                        (position) => processSuccessfulGeolocationMapViewer(position, "Tombol GPS Peta", displayGlobalMapMessage, map, container, iconHTML),
                                        (error) => {
                                            handleGeolocationErrorMapViewer(error, "Gagal dari Tombol GPS Peta", displayGlobalMapMessage);
                                            container.innerHTML = iconHTML;
                                        },
                                        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
                                    );
                                } else {
                                    handleGeolocationErrorMapViewer({code: -1, message: "Browser tidak mendukung geolokasi."}, "Gagal dari Tombol GPS Peta", displayGlobalMapMessage);
                                    container.innerHTML = iconHTML;
                                }
                            });
                        return container;
                    }
                });
                if (map) new GpsMapControl().addTo(map);


                map.on('baselayerchange', function (e) {
                    let newMaxZoom = (e.name === "Satelit") ? satelliteMaxZoom : osmMaxZoom;
                    if (map.options.maxZoom !== newMaxZoom) {
                        map.options.maxZoom = newMaxZoom;
                        if (map.getZoom() > newMaxZoom) map.setZoom(newMaxZoom);
                    }
                });

                map.on('fullscreenchange', function () {
                    const isPluginFullscreen = map.isFullscreen();
                    $('#manualFullscreenBtn i').toggleClass('fa-expand', !isPluginFullscreen).toggleClass('fa-compress', isPluginFullscreen);
                    $('#manualFullscreenBtn').attr('title', isPluginFullscreen ? 'Keluar Layar Penuh (Plugin)' : 'Layar Penuh Peta (Kustom)');
                    if(map) { setTimeout(function() { map.invalidateSize(); }, 250); }
                });
                document.addEventListener('fullscreenchange', handleFullscreenGlobal);
                document.addEventListener('webkitfullscreenchange', handleFullscreenGlobal);
                document.addEventListener('mozfullscreenchange', handleFullscreenGlobal);
                document.addEventListener('MSFullscreenChange', handleFullscreenGlobal);

                const CollapsibleLegendControl = L.Control.extend({
                    options: { position: 'bottomright' },
                    onAdd: function(mapInstance) {
                        const container = L.DomUtil.create('div', 'legend-control legend-collapsed');
                        const toggle = L.DomUtil.create('a', 'legend-toggle', container);
                        toggle.innerHTML = '<i class="fas fa-list-ul"></i>';
                        toggle.href = '#';
                        toggle.title = 'Tampilkan Legenda';

                        const legend = L.DomUtil.create('div', 'info legend', container);
                         const types = [
                            {name: 'ODC (Cabinet)', iconHtml: '<span class="icon-odc"><i class="fas fa-server"></i></span>'},
                            {name: 'ODP (Point)', iconHtml: '<span class="icon-odp"><i class="fas fa-network-wired"></i></span>'},
                            {name: 'Pelanggan Online', iconHtml: '<span class="icon-customer-online"><i class="fas fa-map-marker-alt"></i></span>'},
                            {name: 'Pelanggan Offline', iconHtml: '<span class="icon-customer-offline"><i class="fas fa-map-marker-alt"></i></span>'},
                            {name: 'Pelanggan (Lainnya)', iconHtml: '<span class="icon-customer-unknown"><i class="fas fa-map-marker-alt"></i></span>'},
                            {name: 'Lokasi Saya', iconHtml: '<span class="icon-customer-unknown"><i class="fas fa-street-view"></i></span>'}
                        ];
                        let legendHtml = "<h4>Legenda Peta</h4>";
                        types.forEach(type => { legendHtml += `${type.iconHtml} ${type.name}<br>`; });
                        legend.innerHTML = legendHtml;
                        
                        L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation)
                                  .on(container, 'mousedown', L.DomEvent.stopPropagation)
                                  .on(container, 'dblclick', L.DomEvent.stopPropagation);

                        L.DomEvent.on(toggle, 'click', (e) => {
                            L.DomEvent.stop(e);
                            L.DomUtil.removeClass(container, 'legend-collapsed');
                        });
                        
                        L.DomEvent.on(legend, 'click', (e) => {
                             L.DomEvent.stop(e);
                            L.DomUtil.addClass(container, 'legend-collapsed');
                        });

                        return container;
                    }
                });
                new CollapsibleLegendControl().addTo(map);

                loadAllMapData();
                console.log("[InitializeMap] Inisialisasi peta BERHASIL.");

            } catch (error) {
                console.error("[InitializeMap] ERROR Kritis saat inisialisasi peta:", error);
                $('#interactiveMap').html('<div class="alert alert-danger text-center">Gagal memuat peta. Periksa konsol browser untuk detail teknis. Coba refresh halaman.</div>');
                displayGlobalMapMessage("Gagal total menginisialisasi peta. Periksa konsol untuk detail error.", "danger", 0);
            }
        }
        
        /**
         * Redraws markers of a specific type by updating their icons AND tooltip visibility.
         * This is called when label visibility changes.
         * @param {string} markerType - 'odc', 'odp', or 'customer'.
         */
function redrawMarkers(markerType) {
    let markersToRedraw = [];
    if(markerType === 'odc') {
        markersToRedraw = odcMarkers;
    } else if (markerType === 'odp') {
        markersToRedraw = odpMarkers;
    } else if (markerType === 'customer') {
        markersToRedraw = customerMarkers;
    }

    const currentLabelVisibility = labelVisibility[markerType];

    markersToRedraw.forEach(marker => {
        if(marker && marker.options && typeof marker.setIcon === 'function') {
            // Update icon (which is now just the base icon)
            if (marker.assetData) {
                marker.setIcon(createAssetIcon(marker.assetData));
                
                // Set tooltip content and visibility for asset
                if (marker.assetData.name) {
                    if (!marker.getTooltip()) {
                        marker.bindTooltip(marker.assetData.name, {
                            permanent: true,
                            direction: 'top',
                            className: 'marker-label-tooltip',
                            offset: [0, -ICON_HEIGHT/2 - 5]
                        });
                    } else {
                        marker.getTooltip().setContent(marker.assetData.name);
                    }
                    
                    // Kontrol visibilitas tooltip tanpa mempengaruhi posisi marker
                    if (currentLabelVisibility) {
                        marker.getTooltip().setOpacity(1);
                    } else {
                        marker.getTooltip().setOpacity(0);
                    }
                }
            } else if (marker.customerData) {
                // Update icon for customer
                marker.setIcon(createCustomerStatusIcon(marker.customerOnlineStatus));
                
                // Set tooltip content and visibility for customer
                let customerLabel = marker.customerData.pppoe_username || marker.customerData.name || `Cust. ID ${marker.customerData.id}`;
                if (!marker.getTooltip()) {
                    marker.bindTooltip(customerLabel, {
                        permanent: true,
                        direction: 'top',
                        className: 'marker-label-tooltip',
                        offset: [0, -ICON_HEIGHT/2 - 5]
                    });
                } else {
                    marker.getTooltip().setContent(customerLabel);
                }
                
                // Kontrol visibilitas tooltip tanpa mempengaruhi posisi marker
                if (currentLabelVisibility) {
                    marker.getTooltip().setOpacity(1);
                } else {
                    marker.getTooltip().setOpacity(0);
                }
            }
        }
    });
}

        function toggleFullScreenManual() {
            const mapContainer = document.getElementById('mapContainer');
            if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
                if (mapContainer.requestFullscreen) { mapContainer.requestFullscreen().catch(err => console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`)); }
                else if (mapContainer.mozRequestFullScreen) { mapContainer.mozRequestFullScreen(); }
                else if (mapContainer.webkitRequestFullscreen) { mapContainer.webkitRequestFullscreen(); }
                else if (mapContainer.msRequestFullscreen) { mapContainer.msRequestFullscreen(); }
            } else {
                if (document.exitFullscreen) { document.exitFullscreen(); }
                else if (document.mozCancelFullScreen) { document.mozCancelFullScreen(); }
                else if (document.webkitExitFullscreen) { document.webkitExitFullscreen(); }
                else if (document.msExitFullscreen) { document.msExitFullscreen(); }
            }
        }

        function handleFullscreenGlobal() {
            const isActuallyFullscreen = !!(document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
            $('#manualFullscreenBtn i').toggleClass('fa-expand', !isActuallyFullscreen).toggleClass('fa-compress', isActuallyFullscreen);
            $('#manualFullscreenBtn').attr('title', isActuallyFullscreen ? 'Keluar Layar Penuh (Kustom)' : 'Layar Penuh Peta (Kustom)');
            if (map) { setTimeout(function() { map.invalidateSize(); }, 250); }
        }

        function updateSelectAllCheckbox(type, totalItems, selectedItems) {
            const selectAllCb = $(`#selectAll${type}`);
            if (totalItems > 0 && selectedItems === totalItems) {
                selectAllCb.prop('checked', true).prop('indeterminate', false);
            } else if (selectedItems === 0 || totalItems === 0) {
                selectAllCb.prop('checked', false).prop('indeterminate', false);
            } else {
                selectAllCb.prop('checked', false).prop('indeterminate', true);
            }
        }

        function openCustomFilterModalWithCurrentSelections() {
            console.log("[OpenCustomFilterModal] Populating modal based on current map filter state...");
            $('#searchOdcFilter').val('').trigger('keyup');
            $('#searchOdpFilter').val('').trigger('keyup');
            $('#searchCustomerFilter').val('').trigger('keyup');

            const odcListElement = $('#odcFilterList');
            const allOdcsFromData = allNetworkAssetsData.filter(a => a.type === 'ODC').sort((a, b) => (a.name || '').localeCompare(b.name || ''));

            odcListElement.empty();
            allOdcsFromData.forEach(odc => {
                const isChecked = isInitialLoad ? true : selectedOdcIds.has(String(odc.id));
                odcListElement.append(
                    `<li class="list-group-item">
                        <label><input type="checkbox" class="filter-item-checkbox" data-type="odc" data-id="${odc.id}" ${isChecked ? 'checked' : ''}> ${odc.name || `ODC ID ${odc.id}`}</label>
                    </li>`
                );
            });
            updateSelectAllCheckbox('Odc', allOdcsFromData.length, odcListElement.find('.filter-item-checkbox:checked').length);

            updateOdpFilterListFromModal(isInitialLoad);
            $('#customFilterModal').modal('show');
        }

        function updateOdpFilterListFromModal(checkAllChildrenIfParentIsAll = false) {
            const currentlySelectedOdcIdsInModal = new Set();
            $('#odcFilterList .filter-item-checkbox:checked').each(function() {
                currentlySelectedOdcIdsInModal.add($(this).data('id').toString());
            });

            const odpListElement = $('#odpFilterList');
            odpListElement.empty();
            $('#searchOdpFilter').val('').trigger('keyup');

            if (currentlySelectedOdcIdsInModal.size === 0) {
                odpListElement.append('<li class="list-group-item text-muted small">Pilih ODC untuk melihat daftar ODP terkait.</li>');
                updateSelectAllCheckbox('Odp', 0, 0);
                updateCustomerFilterListFromModal(false);
                return;
            }

            const relevantOdps = allNetworkAssetsData.filter(asset =>
                asset.type === 'ODP' && asset.parent_odc_id && currentlySelectedOdcIdsInModal.has(String(asset.parent_odc_id))
            ).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

            relevantOdps.forEach(odp => {
                const isChecked = checkAllChildrenIfParentIsAll ? true : selectedOdpIds.has(String(odp.id));
                odpListElement.append(
                    `<li class="list-group-item">
                        <label><input type="checkbox" class="filter-item-checkbox" data-type="odp" data-id="${odp.id}" ${isChecked ? 'checked' : ''}> ${odp.name || `ODP ID ${odp.id}`}</label>
                    </li>`
                );
            });
            updateSelectAllCheckbox('Odp', relevantOdps.length, odpListElement.find('.filter-item-checkbox:checked').length);
            updateCustomerFilterListFromModal(checkAllChildrenIfParentIsAll);
        }

        function updateCustomerFilterListFromModal(checkAllChildrenIfParentIsAll = false) {
            const currentlySelectedOdpIdsInModal = new Set();
            $('#odpFilterList .filter-item-checkbox:checked').each(function() {
                currentlySelectedOdpIdsInModal.add($(this).data('id').toString());
            });

            const customerListElement = $('#customerFilterList');
            customerListElement.empty();
            $('#searchCustomerFilter').val('').trigger('keyup');

            if (currentlySelectedOdpIdsInModal.size === 0) {
                customerListElement.append('<li class="list-group-item text-muted small">Pilih ODP untuk melihat daftar Pelanggan terkait.</li>');
                updateSelectAllCheckbox('Customer', 0, 0);
                return;
            }

            const relevantCustomers = allCustomerData.filter(customer =>
                customer.connected_odp_id && currentlySelectedOdpIdsInModal.has(String(customer.connected_odp_id))
            ).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

            relevantCustomers.forEach(customer => {
                const isChecked = checkAllChildrenIfParentIsAll ? true : selectedCustomerIds.has(String(customer.id));
                customerListElement.append(
                    `<li class="list-group-item">
                        <label><input type="checkbox" class="filter-item-checkbox" data-type="customer" data-id="${customer.id}" ${isChecked ? 'checked' : ''}> ${customer.name || `Cust. ID ${customer.id}`}</label>
                    </li>`
                );
            });
            updateSelectAllCheckbox('Customer', relevantCustomers.length, customerListElement.find('.filter-item-checkbox:checked').length);
        }

        $('#openCustomFilterModalBtn').on('click', openCustomFilterModalWithCurrentSelections);

        $(document).on('change', '#customFilterModal .filter-item-checkbox', function() {
            const type = $(this).data('type');
            if (type === 'odc') {
                updateSelectAllCheckbox('Odc', $('#odcFilterList .filter-item-checkbox').length, $('#odcFilterList .filter-item-checkbox:checked').length);
                updateOdpFilterListFromModal(false);
            } else if (type === 'odp') {
                updateSelectAllCheckbox('Odp', $('#odpFilterList .filter-item-checkbox').length, $('#odpFilterList .filter-item-checkbox:checked').length);
                updateCustomerFilterListFromModal(false);
            } else if (type === 'customer') {
                updateSelectAllCheckbox('Customer', $('#customerFilterList .filter-item-checkbox').length, $('#customerFilterList .filter-item-checkbox:checked').length);
            }
        });

        $(document).on('change', '#selectAllOdc, #selectAllOdp, #selectAllCustomer', function() {
            const type = $(this).attr('id').replace('selectAll', '').toLowerCase();
            const listElement = $(`#${type}FilterList`);
            const isChecked = $(this).is(':checked');

            listElement.find('.filter-item-checkbox').prop('checked', isChecked); 

            if (type === 'odc') {
                updateOdpFilterListFromModal(isChecked);
                updateSelectAllCheckbox('Odc', listElement.find('.filter-item-checkbox').length, isChecked ? listElement.find('.filter-item-checkbox').length : 0);
            } else if (type === 'odp') {
                updateCustomerFilterListFromModal(isChecked);
                updateSelectAllCheckbox('Odp', listElement.find('.filter-item-checkbox').length, isChecked ? listElement.find('.filter-item-checkbox').length : 0);
            } else if (type === 'customer') {
                 updateSelectAllCheckbox('Customer', listElement.find('.filter-item-checkbox').length, isChecked ? listElement.find('.filter-item-checkbox').length : 0);
            }
        });


        $('#applyCustomFilterBtn').on('click', function() {
            console.log("[ApplyCustomFilterBtn] Applying custom filter...");
            selectedOdcIds.clear();
            selectedOdpIds.clear();
            selectedCustomerIds.clear();

            $('#odcFilterList .filter-item-checkbox:checked').each(function() { selectedOdcIds.add($(this).data('id').toString()); });
            $('#odpFilterList .filter-item-checkbox:checked').each(function() { selectedOdpIds.add($(this).data('id').toString()); });
            $('#customerFilterList .filter-item-checkbox:checked').each(function() { selectedCustomerIds.add($(this).data('id').toString()); });

            isInitialLoad = false;
            applyFilters();
            $('#customFilterModal').modal('hide');
            displayGlobalMapMessage('Filter kustom diterapkan.', 'success', 3000);
        });

        $('#resetCustomFilterBtn').on('click', function() {
            $('#odcFilterList .filter-item-checkbox').prop('checked', true);
            updateSelectAllCheckbox('Odc', $('#odcFilterList .filter-item-checkbox').length, $('#odcFilterList .filter-item-checkbox').length);
            updateOdpFilterListFromModal(true);

            displayGlobalMapMessage('Filter direset untuk menampilkan semua. Klik "Terapkan Filter" untuk menyimpan.', 'info', 5000);
        });

        $('.filter-search-input').on('keyup', function() {
            const searchTerm = $(this).val().toLowerCase();
            const listId = $(this).nextAll('.filter-list-column').first().attr('id');
            $(`#${listId} li`).each(function() {
                const itemText = $(this).text().toLowerCase();
                if (itemText.includes(searchTerm)) {
                    $(this).show();
                } else {
                    $(this).hide();
                }
            });
        });

        function applyFilters() {
            if (!map) return;
            console.log("[ApplyFilters] Menerapkan filter. ODCs selected:", selectedOdcIds.size, "ODPs:", selectedOdpIds.size, "Customers:", selectedCustomerIds.size);

            networkMarkersLayer.clearLayers();
            customerMarkersLayer.clearLayers();
            linesLayer.clearLayers();

            odcMarkers.forEach(marker => {
                if (selectedOdcIds.has(String(marker.assetData.id))) {
                    networkMarkersLayer.addLayer(marker);
                    // Also ensure tooltip visibility is correctly applied
                    if (marker.getTooltip()) {
                        marker.getTooltip().setOpacity(labelVisibility.odc ? 1 : 0);
                    }
                }
            });

            odpMarkers.forEach(marker => {
                if (selectedOdpIds.has(String(marker.assetData.id))) {
                    networkMarkersLayer.addLayer(marker);
                     // Also ensure tooltip visibility is correctly applied
                    if (marker.getTooltip()) {
                        marker.getTooltip().setOpacity(labelVisibility.odp ? 1 : 0);
                    }
                }
            });

            customerMarkers.forEach(marker => {
                if (selectedCustomerIds.has(String(marker.customerData.id))) {
                    customerMarkersLayer.addLayer(marker);
                     // Also ensure tooltip visibility is correctly applied
                    if (marker.getTooltip()) {
                        marker.getTooltip().setOpacity(labelVisibility.customer ? 1 : 0);
                    }
                }
            });

            odpToOdcLines.forEach(line => {
                if (line.connectedEntities &&
                    selectedOdcIds.has(String(line.connectedEntities.odcId)) &&
                    selectedOdpIds.has(String(line.connectedEntities.odpId))) {
                    linesLayer.addLayer(line);
                }
            });

            customerToOdpLines.forEach(line => {
                 if (line.connectedEntities &&
                    selectedCustomerIds.has(String(line.connectedEntities.customerId)) &&
                    selectedOdpIds.has(String(line.connectedEntities.odpId))) {
                    linesLayer.addLayer(line);
                }
            });
            console.log("[ApplyFilters] Filter diterapkan.");
        }


        // MODIFIED: populateParentOdcDropdown to include capacity and disable full ODCs
        function populateParentOdcDropdown(selectedParentId = null) {
            const select = $('#assetParentOdc');
            const currentValue = selectedParentId || select.val();
            select.empty().append('<option value="">-- Tidak ada / ODC Induk --</option>');

            const odcsForDropdown = allNetworkAssetsData.filter(a => a.type === 'ODC');

            if(odcsForDropdown && odcsForDropdown.length > 0){
                odcsForDropdown.sort((a,b) => (a.name || '').localeCompare(b.name || '')).forEach(odc => {
                    const odcCapacity = parseInt(odc.capacity_ports) || 0;
                    const portsUsed = parseInt(odc.ports_used) || 0; // ODC ports_used counts connected ODPs
                    const isFull = (odcCapacity > 0 && portsUsed >= odcCapacity);

                    // Check if the current ODP being edited is already connected to this ODC
                    const isCurrentOdcForEditedOdp = (selectedParentId !== null && String(odc.id) === String(selectedParentId));

                    let displayText = `${odc.name} (ID: ${odc.id}) - ODP: ${portsUsed}/${odcCapacity || 'N/A'}`;
                    if (isFull && !isCurrentOdcForEditedOdp) {
                        displayText += ' (PENUH)';
                    } else if (isCurrentOdcForEditedOdp && isFull) {
                        displayText += ' (Sedang Digunakan - PENUH)'; // Clarify for the current ODP
                    }

                    const option = new Option(displayText, odc.id);
                    if (isFull && !isCurrentOdcForEditedOdp) {
                        option.disabled = true;
                    }
                    select.append(option);
                });
            }
            if(currentValue && select.find(`option[value="${currentValue}"]`).length > 0) {
                 select.val(currentValue);
            } else {
                 select.val("");
            }
            if (select.hasClass("select2-hidden-accessible")) {
                 select.trigger('change.select2');
            }
        }

        $('#assetType').on('change', function() {
            const type = $(this).val();
            const isNewAsset = !$('#assetId').val();
            $('#odcPortsUsedLabelInfo').hide();
            $('#odpPortsUsedLabelInfo').hide();

            if (type === 'ODP') {
                $('#parentOdcGroup').slideDown();
                // Pass current parent ID if editing an ODP to ensure its current ODC option isn't disabled due to being "full"
                populateParentOdcDropdown($('#assetParentOdc').data('current-odp-parent') || null);
                $('#assetPortsUsed').prop('readonly', true).attr('placeholder', 'Otomatis');
                $('#odpPortsUsedLabelInfo').show();
                if (isNewAsset) {
                    $('#assetPortsUsed').val('');
                }
            } else { // ODC
                $('#parentOdcGroup').slideUp();
                $('#assetPortsUsed').prop('readonly', true).attr('placeholder', 'Otomatis');
                $('#odcPortsUsedLabelInfo').show();
                 if (isNewAsset) {
                     $('#assetPortsUsed').val('');
                }
            }
        });

        $('#useParentOdcLocation').on('change', function() {
            if ($(this).is(':checked')) {
                const parentOdcId = $('#assetParentOdc').val();
                if (parentOdcId) {
                    const selectedOdc = allNetworkAssetsData.find(odc => odc.type === 'ODC' && odc.id == parentOdcId);
                    if (selectedOdc) {
                        const lat = parseFloat(selectedOdc.latitude).toFixed(5);
                        const lng = parseFloat(selectedOdc.longitude).toFixed(5);
                        $('#assetLatitude').val(lat).prop('readonly', true);
                        $('#assetLongitude').val(lng).prop('readonly', true);
                        if (assetModalMapInstance && assetModalMapMarker) {
                            assetModalMapMarker.setLatLng([lat, lng]);
                            assetModalMapInstance.setView([lat, lng], assetModalMapInstance.getZoom());
                        }
                    }
                } else {
                    displayGlobalMapMessage('Pilih ODC Induk terlebih dahulu untuk menggunakan lokasinya.', 'warning');
                    $(this).prop('checked', false);
                }
            } else {
                $('#assetLatitude').prop('readonly', false);
                $('#assetLongitude').prop('readonly', false);
            }
        });

        // New function for the map inside asset modal
        function initializeAssetModalMap(mapId, latInputId, lngInputId, initialLat, initialLng) {
            if (assetModalMapInstance) { assetModalMapInstance.remove(); assetModalMapInstance = null; }
            if (assetModalMapMarker) { assetModalMapMarker.remove(); assetModalMapMarker = null; }

            const latInput = $(`#${latInputId}`);
            const lngInput = $(`#${lngInputId}`);

            const defaultLat = -7.24139; // Default central location for asset modal map
            const defaultLng = 111.83833;
            const defaultZoom = 15;

            const viewLat = (initialLat && !isNaN(parseFloat(initialLat))) ? parseFloat(initialLat) : defaultLat;
            const viewLng = (initialLng && !isNaN(parseFloat(initialLng))) ? parseFloat(initialLng) : defaultLng;
            const viewZoom = (initialLat && initialLng && !isNaN(parseFloat(initialLat)) && !isNaN(parseFloat(initialLng))) ? 17 : defaultZoom;

            const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            });
            const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                maxZoom: 20,
                attribution: 'Tiles &copy; Esri'
            });

            assetModalMapInstance = L.map(mapId, {
                layers: [satelliteLayer], // Default layer
                maxZoom: 20
            }).setView([viewLat, viewLng], viewZoom);

            const baseMaps = { "Satelit": satelliteLayer, "OpenStreetMap": osmLayer };
            L.control.layers(baseMaps, null, { collapsed: true, position: 'topright' }).addTo(assetModalMapInstance);

            function updateMarkerAndInputs(latlng, setView = false) {
                latInput.val(latlng.lat.toFixed(5));
                lngInput.val(latlng.lng.toFixed(5));
                if (!assetModalMapMarker) {
                    assetModalMapMarker = L.marker(latlng, { draggable: true }).addTo(assetModalMapInstance);
                    assetModalMapMarker.on('dragend', function (event) {
                        const pos = event.target.getLatLng();
                        latInput.val(pos.lat.toFixed(5));
                        lngInput.val(pos.lng.toFixed(5));
                    });
                } else {
                    assetModalMapMarker.setLatLng(latlng);
                }
                if (setView) {
                    assetModalMapInstance.setView(latlng, Math.max(assetModalMapInstance.getZoom(), 16));
                }
            }

            if (initialLat != null && initialLng != null && !isNaN(parseFloat(initialLat)) && !isNaN(parseFloat(initialLng))) {
                 updateMarkerAndInputs(L.latLng(parseFloat(initialLat), parseFloat(initialLng)), false);
            }

            const GpsControl = L.Control.extend({
                options: { position: 'topleft' },
                onAdd: function (mapCtrl) {
                    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom-gps');
                    const originalIconHTML = '<i class="fas fa-map-marker-alt"></i>';
                    const loadingIconHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    container.innerHTML = originalIconHTML;
                    container.title = 'Dapatkan Lokasi GPS Saat Ini';

                    L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation)
                        .on(container, 'click', L.DomEvent.preventDefault)
                        .on(container, 'click', function () {
                            container.innerHTML = loadingIconHTML;
                            // Re-use global map message for consistent display
                            displayGlobalMapMessage("Meminta lokasi GPS Anda...", "info", 3000);
                            if (navigator.geolocation) {
                                navigator.geolocation.getCurrentPosition(
                                    (position) => processSuccessfulGeolocationMapViewer(position, "Tombol GPS Modal", displayGlobalMapMessage, assetModalMapInstance, container, originalIconHTML),
                                    (error) => {
                                        handleGeolocationErrorMapViewer(error, "Gagal dari Tombol GPS Modal", displayGlobalMapMessage);
                                        container.innerHTML = originalIconHTML;
                                    },
                                    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
                                );
                            } else {
                                handleGeolocationErrorMapViewer({code: -1, message: "Browser tidak mendukung geolokasi."}, "Gagal dari Tombol GPS Modal", displayGlobalMapMessage);
                                container.innerHTML = originalIconHTML;
                            }
                        });
                    return container;
                }
            });
            new GpsControl().addTo(assetModalMapInstance);

            assetModalMapInstance.on('click', function (e) {
                updateMarkerAndInputs(e.latlng);
            });
            // Ensure map resizes correctly when modal is shown
            $('#assetModal').off('shown.bs.modal.assetmapfix').on('shown.bs.modal.assetmapfix', function() {
                 setTimeout(function () { if (assetModalMapInstance) assetModalMapInstance.invalidateSize(); }, 10);
            });
             if ($('#assetModal').is(':visible')) {
                 setTimeout(function () { if (assetModalMapInstance) assetModalMapInstance.invalidateSize(); }, 10);
            }
        }


        function openAssetModal(assetData = null, lat, lng) {
            $('#assetForm')[0].reset();
            $('#useParentOdcLocation').prop('checked', false);
            $('#deleteAssetBtn').hide();
            $('#assetLatitude').prop('readonly', false);
            $('#assetLongitude').prop('readonly', false);
            $('#assetId').val('');
            $('#assetParentOdc').data('current-odp-parent', null);
            $('#odcPortsUsedLabelInfo').hide();
            $('#odpPortsUsedLabelInfo').hide();
            $('#assetPortsUsed').val(''); // Clear on open

            let initialLat = lat;
            let initialLng = lng;

            if (assetData && assetData.id) {
                $('#assetModalLabel').text(`Edit Aset: ${assetData.name || assetData.id} (${assetData.type})`);
                $('#assetId').val(assetData.id);
                $('#assetType').val(assetData.type);
                $('#assetName').val(assetData.name);
                $('#assetAddress').val(assetData.address);
                $('#assetLatitude').val(assetData.latitude != null ? parseFloat(assetData.latitude).toFixed(5) : '');
                $('#assetLongitude').val(assetData.longitude != null ? parseFloat(assetData.longitude).toFixed(5) : '');
                $('#assetCapacity').val(assetData.capacity_ports);
                $('#assetNotes').val(assetData.notes);

                let portsUsedForDisplay = assetData.ports_used || 0;
                // Recalculate ports_used for ODPs based on current customer data
                if(assetData.type === 'ODP'){
                    const connectedCustomersToThisOdp = allCustomerData.filter(cust => String(cust.connected_odp_id) === String(assetData.id));
                    portsUsedForDisplay = connectedCustomersToThisOdp.length;
                }
                $('#assetPortsUsed').val(portsUsedForDisplay);


                $('#assetType').trigger('change');

                if (assetData.type === 'ODP') {
                    $('#assetParentOdc').data('current-odp-parent', assetData.parent_odc_id);
                }
                $('#deleteAssetBtn').show();
                initialLat = assetData.latitude;
                initialLng = assetData.longitude;
            } else {
                $('#assetModalLabel').text('Tambah Aset Jaringan Baru');
                $('#assetType').val('ODC').trigger('change');
            }

            // Always re-initialize select2 for the parent ODC dropdown
            if ($('#assetParentOdc').data('select2')) {
                 try { $('#assetParentOdc').select2('destroy'); } catch(e){}
            }
            $('#assetParentOdc').select2({
                theme: "bootstrap",
                dropdownParent: $('#assetModal'),
                placeholder: '-- Pilih ODC Induk --',
                allowClear: true
            });

            // Set parent ODC value and trigger change event to re-populate if necessary
            if (assetData && assetData.type === 'ODP' && assetData.parent_odc_id) {
                $('#assetParentOdc').val(assetData.parent_odc_id).trigger('change.select2');
            } else if (!assetData || assetData.type === 'ODC') {
                 $('#assetParentOdc').val(null).trigger('change.select2');
            }

            // Initialize the mini map within the modal
            initializeAssetModalMap('assetModalMap', 'assetLatitude', 'assetLongitude', initialLat, initialLng);

            $('#assetModal').modal('show');
        }


        $('#assetForm').on('submit', async function(event) {
            event.preventDefault();
            const assetIdFromForm = $('#assetId').val();
            const assetType = $('#assetType').val();
            const name = $('#assetName').val().trim();
            const latitudeVal = $('#assetLatitude').val();
            const longitudeVal = $('#assetLongitude').val();

            if (!name) { displayGlobalMapMessage('Nama aset wajib diisi.', 'warning'); return; }
            if (latitudeVal === '' || longitudeVal === '' || isNaN(parseFloat(latitudeVal)) || isNaN(parseFloat(longitudeVal))) {
                displayGlobalMapMessage('Latitude dan Longitude harus berupa angka yang valid dan tidak boleh kosong.', 'warning'); return;
            }

            const data = {
                type: assetType,
                name: name,
                address: $('#assetAddress').val().trim(),
                latitude: parseFloat(latitudeVal),
                longitude: parseFloat(longitudeVal),
                capacity_ports: parseInt($('#assetCapacity').val()) || null,
                notes: $('#assetNotes').val().trim(),
                parent_odc_id: assetType === 'ODP' ? ($('#assetParentOdc').val() || null) : null
            };
             data.capacity_ports = data.capacity_ports === 0 ? null : data.capacity_ports;


            const url = assetIdFromForm ? `/api/map/network-assets/${assetIdFromForm}` : '/api/map/network-assets';
            const method = assetIdFromForm ? 'PUT' : 'POST';
            const saveButton = $('#saveAssetBtn');
            const originalButtonText = saveButton.html();
            saveButton.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Menyimpan...');

            try {
                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await response.json();

                if (response.ok && (result.status === 200 || result.status === 201)) {
                    $('#assetModal').modal('hide');

                    if (!assetIdFromForm && result.data && result.data.id) {
                        const newAssetId = String(result.data.id);
                        if (result.data.type === 'ODC') selectedOdcIds.add(newAssetId);
                        else if (result.data.type === 'ODP') selectedOdpIds.add(newAssetId);
                    }

                    await loadAllMapData();

                    if (!assetIdFromForm && result.data && result.data.type === 'ODC') {
                        document.getElementById('addOdpAfterOdcMessageText').textContent = `ODC "${result.data.name}" (ID: ${result.data.id}) berhasil disimpan.`;
                        const yesBtn = document.getElementById('yesAddOdpBtn');
                        yesBtn.setAttribute('data-odc-id', result.data.id);
                        yesBtn.setAttribute('data-lat', result.data.latitude);
                        yesBtn.setAttribute('data-lng', result.data.longitude);
                        $('#addOdpAfterOdcModal').modal('show');
                    } else {
                        displayGlobalMapMessage(result.message, 'success');
                    }
                } else {
                    displayGlobalMapMessage(`Error Simpan: ${result.message || `Gagal menyimpan aset (Status: ${response.status})`}`, 'danger');
                }
            } catch (error) {
                console.error("[AssetFormSubmit] Error saving asset:", error);
                displayGlobalMapMessage('Kesalahan koneksi atau format respons tidak valid saat menyimpan aset.', 'danger');
            } finally {
                saveButton.prop('disabled', false).html(originalButtonText);
            }
        });

        $('#deleteAssetBtn').on('click', async function() {
            const assetId = $('#assetId').val();
            const assetType = $('#assetType').val();
            const originalButtonText = $(this).html();
            if (!assetId) {
                displayGlobalMapMessage('ID Aset tidak ditemukan untuk dihapus.', 'warning'); return;
            }
            if (confirm(`Apakah Anda yakin ingin menghapus aset ini (ID: ${assetId})? Jika ini ODC, ODP yang terhubung tidak akan otomatis terhapus namun relasinya akan hilang. Tindakan ini tidak dapat dibatalkan.`)) {
                const deleteButton = $(this);
                deleteButton.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Menghapus...');
                try {
                    const response = await fetch(`/api/map/network-assets/${assetId}`, { method: 'DELETE' });
                    const result = await response.json();
                    if (response.ok && result.status === 200) {
                        displayGlobalMapMessage(result.message, 'success');
                        $('#assetModal').modal('hide');
                        if (assetType === 'ODC') selectedOdcIds.delete(String(assetId));
                        else if (assetType === 'ODP') selectedOdpIds.delete(String(assetId));
                        loadAllMapData();
                    } else {
                        displayGlobalMapMessage(result.message || `Gagal menghapus aset (Status: ${response.status})`, 'danger');
                    }
                } catch (error) {
                    console.error("[DeleteAsset] Error deleting asset:", error);
                    displayGlobalMapMessage('Terjadi kesalahan koneksi saat menghapus aset.', 'danger');
                } finally {
                    deleteButton.prop('disabled', false).html(originalButtonText);
                }
            }
        });

        $('#assetModal').on('hidden.bs.modal', function () {
             // Destroy the mini map instance when the modal is hidden
            if (assetModalMapInstance) {
                assetModalMapInstance.remove();
                assetModalMapInstance = null;
                assetModalMapMarker = null;
            }
        });

        async function fetchAllCustomerData() {
            console.log("[fetchAllCustomerData] Memulai pemuatan data pelanggan...");
            try {
                const response = await fetch(`/api/users?_=${new Date().getTime()}`);
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error("[fetchAllCustomerData] API Error:", response.status, errorText.substring(0, 200));
                    displayGlobalMapMessage(`Gagal memuat data pelanggan awal: Status ${response.status}.`, 'danger');
                    allCustomerData = [];
                    throw new Error(`API Users error for prefetch: ${response.status}`);
                }
                const result = await response.json();
                if (result.data && Array.isArray(result.data)) {
                    allCustomerData = result.data;
                    console.log("[fetchAllCustomerData] Data pelanggan berhasil dimuat:", allCustomerData.length);
                    return true;
                } else {
                    console.warn("[fetchAllCustomerData] Format API pelanggan salah atau tidak ada data. Result:", result);
                    allCustomerData = [];
                    return false;
                }
            } catch (error) {
                console.error("[fetchAllCustomerData] Kesalahan saat mengambil data pelanggan:", error);
                displayGlobalMapMessage("Kesalahan koneksi saat mengambil data pelanggan awal. Cek konsol.", 'danger');
                allCustomerData = [];
                throw error;
            }
        }
        
        async function fetchAllNetworkAssets() {
            console.log("[fetchAllNetworkAssets] Memulai pemuatan data aset jaringan...");
            try {
                const response = await fetch(`/api/map/network-assets?_=${new Date().getTime()}`);
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error("[fetchAllNetworkAssets] API Error:", response.status, errorText.substring(0, 500));
                    displayGlobalMapMessage(`Gagal memuat data aset jaringan awal: Status ${response.status}.`, 'danger');
                    allNetworkAssetsData = [];
                    throw new Error(`API Network Assets error: ${response.status}`);
                }
                const result = await response.json();
                if (result.status === 200 && Array.isArray(result.data)) {
                    allNetworkAssetsData = result.data;
                    console.log("[fetchAllNetworkAssets] Data aset jaringan berhasil dimuat:", allNetworkAssetsData.length);
                    return true;
                } else {
                    console.warn("[fetchAllNetworkAssets] Format API aset salah atau tidak ada data. Result:", result);
                    allNetworkAssetsData = [];
                    return false;
                }
            } catch (error) {
                console.error("[fetchAllNetworkAssets] Kesalahan saat mengambil data aset jaringan:", error);
                displayGlobalMapMessage("Kesalahan koneksi saat mengambil data aset jaringan. Cek konsol.", 'danger');
                allNetworkAssetsData = [];
                throw error;
            }
        }


        async function loadAllMapData() {
            console.log("[loadAllMapData] Memulai pemuatan semua data peta...");
            const initialMessageDiv = $('#globalMessageMap .alert-info');
            if (!initialMessageDiv.hasClass('alert-danger') && !initialMessageDiv.hasClass('alert-warning')) {
                displayGlobalMapMessage("Memuat data peta, mohon tunggu...", "info", 20000);
            }

            odcMarkers = []; 
            odpMarkers = [];
            customerMarkers = [];
            odpToOdcLines = [];
            customerToOdpLines = [];


            let networkLoadedSuccessfully = false;
            let customerDataFetchedSuccessfully = false;
            let markersProcessedSuccessfully = false;
            let pppoeStatusLoadedSuccessfully = false;

            try {
                await fetchActivePppoeUsers();
                pppoeStatusLoadedSuccessfully = !initialPppoeLoadFailed;

                await fetchAllCustomerData();
                customerDataFetchedSuccessfully = true;

                await fetchAllNetworkAssets();
                networkLoadedSuccessfully = true;

                if (networkLoadedSuccessfully && customerDataFetchedSuccessfully) {
                    await loadNetworkAssetMarkers();
                    await loadCustomerMarkers();
                    markersProcessedSuccessfully = true;
                }

            } catch (error) {
                console.error("[loadAllMapData] Gagal selama fase pemuatan atau pemrosesan data:", error);
            }


            if (isInitialLoad) {
                console.log("[loadAllMapData] Initial load, selecting all items for filter sets.");
                selectedOdcIds.clear();
                selectedOdpIds.clear();
                selectedCustomerIds.clear();
                allNetworkAssetsData.forEach(asset => {
                    if (asset.type === 'ODC') selectedOdcIds.add(String(asset.id));
                    else if (asset.type === 'ODP') selectedOdpIds.add(String(asset.id));
                });
                allCustomerData.forEach(customer => selectedCustomerIds.add(String(customer.id)));
                // Mark initial load complete
                isInitialLoad = false;
            }
            
            // Call applyFilters *after* all marker arrays are populated
            applyFilters(); // Apply filters to actually add markers to layers

            const currentMessageDiv = $('#globalMessageMap .alert');
            if (networkLoadedSuccessfully && customerDataFetchedSuccessfully && markersProcessedSuccessfully) {
                 if (!pppoeStatusLoadedSuccessfully) {
                    if (!currentMessageDiv.hasClass('alert-danger') && !currentMessageDiv.hasClass('alert-warning')) {
                        displayGlobalMapMessage("Data peta dimuat, status online pelanggan mungkin tidak akurat (gagal ambil data PPPoE).", "warning", 10000);
                    }
                } else if (allNetworkAssetsData.length === 0 && allCustomerData.length === 0) {
                     if (!currentMessageDiv.hasClass('alert-danger') && !currentMessageDiv.hasClass('alert-warning')) {
                        displayGlobalMapMessage("Belum ada data aset jaringan atau pelanggan. Klik peta untuk menambah aset baru.", "info", 10000);
                    }
                } else {
                     if (currentMessageDiv.hasClass('alert-info') && currentMessageDiv.text().includes("Memuat data peta")) {
                         currentMessageDiv.alert('close');
                    }
                }
            } else {
                if (!currentMessageDiv.hasClass('alert-danger') && !currentMessageDiv.hasClass('alert-warning')) {
                     displayGlobalMapMessage("Sebagian data peta gagal dimuat. Beberapa informasi mungkin tidak lengkap atau akurat. Periksa konsol.", "warning", 0);
                }
            }
        }


        async function loadNetworkAssetMarkers() {
            console.log("[loadNetworkAssetMarkers] Memulai pemrosesan marker aset jaringan...");
            try {
                const assets = allNetworkAssetsData;
                allOdcData = assets.filter(asset => asset.type === 'ODC' && asset.latitude != null && asset.longitude != null)
                                   .map(asset => JSON.parse(JSON.stringify(asset)));
                populateParentOdcDropdown();

                const assetsByLocation = new Map();
                assets.forEach(asset => {
                    if (asset.latitude != null && asset.longitude != null) {
                        const locKey = `${parseFloat(asset.latitude).toFixed(5)},${parseFloat(asset.longitude).toFixed(5)}`;
                        if (!assetsByLocation.has(locKey)) assetsByLocation.set(locKey, []);
                        assetsByLocation.get(locKey).push(asset);
                    }
                });


                assets.forEach(asset => {
                    if (asset.latitude != null && asset.longitude != null) {
                        let plotLat = parseFloat(asset.latitude);
                        let plotLng = parseFloat(asset.longitude);
                        if (isNaN(plotLat) || isNaN(plotLng)) { console.warn("Koordinat tidak valid:", asset); return; }

                        let iconToUse = createAssetIcon(asset);

                        if (asset.type === 'ODP' && asset.parent_odc_id) {
                            const parentOdc = allOdcData.find(o => o.id == asset.parent_odc_id);
                            // Only apply offset if ODP is at the exact same coordinates as its parent ODC
                            if (parentOdc && parentOdc.latitude != null && parentOdc.longitude != null &&
                                Math.abs(parseFloat(parentOdc.latitude) - parseFloat(asset.latitude)) < 0.000001 &&
                                Math.abs(parseFloat(parentOdc.longitude) - parseFloat(asset.longitude)) < 0.000001) {
                                const randomAngle = Math.random() * 2 * Math.PI;
                                const offsetDistance = 0.00003 + (Math.random() * 0.00002); // 3-5 meters offset
                                plotLat += Math.sin(randomAngle) * offsetDistance;
                                plotLng += Math.cos(randomAngle) * offsetDistance;
                            }
                        }

                        let portsUsedDisplay;
                        if (asset.type === 'ODC') {
                            portsUsedDisplay = `${asset.ports_used || 0} ODP terhubung`;
                        } else if (asset.type === 'ODP') {
                            const connectedCustomersToThisOdp = allCustomerData.filter(cust => String(cust.connected_odp_id) === String(asset.id));
                            portsUsedDisplay = `${connectedCustomersToThisOdp.length} port terpakai`;
                        } else {
                             portsUsedDisplay = `${asset.ports_used || 0} (status tidak diketahui)`;
                        }


                        let popupContent = `<b>${asset.name || 'Aset'} (${asset.type})</b><p>ID: ${asset.id}</p>` +
                                         (asset.address ? `<p>Alamat: ${asset.address}</p>` : '') +
                                         `<p>Kapasitas: ${asset.capacity_ports || 'N/A'} Port / Status: ${portsUsedDisplay}</p>`;

                        const originalLocKey = `${parseFloat(asset.latitude).toFixed(5)},${parseFloat(asset.longitude).toFixed(5)}`;
                        const coLocatedAssets = (assetsByLocation.get(originalLocKey) || []).filter(a => a.id !== asset.id);
                        if (coLocatedAssets.length > 0) {
                            popupContent += `<hr class="my-1" style="border-top: 1px dashed #ccc;"><em><small>Juga di lokasi ini:</small></em>`;
                            coLocatedAssets.forEach(other => { popupContent += `<p class="mb-0 ml-2 small">- ${other.type}: ${other.name} (ID: ${other.id})</p>`; });
                        }

                        if (asset.type === 'ODC') {
                            const connectedOdps = allNetworkAssetsData.filter(odp => odp.type === 'ODP' && String(odp.parent_odc_id) === String(asset.id));
                            if (connectedOdps.length > 0) {
                                popupContent += `<hr class="my-1"><p class="mb-1"><strong><i class="fas fa-network-wired"></i> ODP Terhubung (${connectedOdps.length}):</strong></p><ul class="list-unstyled ml-3 mb-1" style="font-size:0.85em;">`;
                                connectedOdps.sort((a,b) => (a.name || '').localeCompare(b.name || '')).forEach(odp => {
                                    const odpConnectedCustomersCount = allCustomerData.filter(cust => String(cust.connected_odp_id) === String(odp.id)).length;
                                    popupContent += `<li>- ${odp.name || `ODP ID ${odp.id}`} (Kap: ${odp.capacity_ports || 'N/A'}, Pakai: ${odpConnectedCustomersCount})</li>`;
                                });
                                popupContent += `</ul>`;
                            } else {
                                popupContent += `<p class="small text-muted mt-1"><em>Tidak ada ODP terhubung ke ODC ini.</em></p>`;
                            }
                        }

                        if (asset.type === 'ODP') {
                            if (asset.parent_odc_id) {
                                const parent = allOdcData.find(o => String(o.id) === String(asset.parent_odc_id));
                                popupContent += `<p>Induk ODC: ${parent ? `${parent.name} (ID: ${asset.parent_odc_id})` : `ID ${asset.parent_odc_id || '-'}`}</p>`;
                                if (parent && parent.latitude != null && parent.longitude != null) {
                                    const dist = haversineDistance({ latitude: parseFloat(asset.latitude), longitude: parseFloat(asset.longitude) }, { latitude: parseFloat(parent.latitude), longitude: parseFloat(parent.longitude) });
                                    if (!isNaN(dist)) popupContent += `<p>Jarak ke ODC Induk: ${dist.toFixed(0)} meter</p>`;
                                }
                            }
                            const connectedCustomers = allCustomerData.filter(cust => String(cust.connected_odp_id) === String(asset.id));
                            if (connectedCustomers.length > 0) {
                                popupContent += `<hr class="my-1"><p class="mb-1"><strong><i class="fas fa-users"></i> Pelanggan Terhubung (${connectedCustomers.length}):</strong></p><ul class="list-unstyled ml-3 mb-1" style="font-size:0.85em;">`;
                                // MODIFIED: Display pppoe_username for connected customers
                                connectedCustomers.sort((a,b) => (a.name || '').localeCompare(b.name || '')).forEach(customer => {
                                    let onlineStatus = 'unknown';
                                    if (customer.pppoe_username) onlineStatus = activePppoeUsersMap.has(customer.pppoe_username) ? 'online' : 'offline';
                                    if (initialPppoeLoadFailed && customer.pppoe_username) onlineStatus = 'unknown'; else if (!customer.pppoe_username) onlineStatus = 'offline';
                                    const statusColor = onlineStatus === 'online' ? 'text-success' : (onlineStatus === 'offline' ? 'text-danger' : 'text-muted');
                                    // Use pppoe_username if available, otherwise fallback to customer name
                                    const customerDisplayId = customer.pppoe_username || customer.name || `Cust. ID ${customer.id}`;
                                    popupContent += `<li>- ${customerDisplayId} <span class="${statusColor}" style="font-weight:bold;">(${onlineStatus.charAt(0).toUpperCase() + onlineStatus.slice(1)})</span></li>`;
                                });
                                popupContent += `</ul>`;
                            } else {
                                popupContent += `<p class="small text-muted mt-1"><em>Tidak ada pelanggan terhubung ke ODP ini.</em></p>`;
                            }
                        }

                        popupContent += `<p>Lat: ${parseFloat(asset.latitude).toFixed(5)}, Lng: ${parseFloat(asset.longitude).toFixed(5)}</p>`;
                        if(asset.notes) popupContent += `<p>Catatan: ${asset.notes}</p>`;
                        if(asset.createdBy) popupContent += `<p><small>Dibuat: ${asset.createdBy} (${new Date(asset.createdAt).toLocaleDateString('id-ID', {day:'2-digit',month:'short',year:'numeric'})})</small></p>`;
                        if(asset.updatedBy && asset.updatedAt && asset.createdAt && new Date(asset.updatedAt).getTime() !== new Date(asset.createdAt).getTime()) {
                            popupContent += `<p><small>Diupdate: ${asset.updatedBy} (${new Date(asset.updatedAt).toLocaleDateString('id-ID', {day:'2-digit',month:'short',year:'numeric'})})</small></p>`;
                        }
                        popupContent += `<button class="btn btn-sm btn-primary btn-edit-asset">Edit Aset Ini</button>`;

                        const marker = L.marker([plotLat, plotLng], { icon: iconToUse }).bindPopup(popupContent);
                        marker.assetData = JSON.parse(JSON.stringify(asset));
                        // Bind tooltip for assets (ODC/ODP)
                        if (asset.name) {
                            marker.bindTooltip(asset.name, {
                                permanent: true, // Always show unless hidden by control
                                direction: 'top',
                                className: 'marker-label-tooltip',
                                offset: [0, -ICON_HEIGHT/2 - 5] // Adjust offset to position above icon
                            });
                            // Set initial visibility
                            if (!labelVisibility[asset.type.toLowerCase()]) {
                                marker.getTooltip().setOpacity(0);
                            }
                        }

                        if (asset.type === 'ODC') odcMarkers.push(marker);
                        else if (asset.type === 'ODP') odpMarkers.push(marker);
                    }
                });

                odpMarkers.forEach(odpMarker => {
                    const odpAsset = odpMarker.assetData;
                    if (odpAsset.parent_odc_id) {
                        const parentOdcMarker = odcMarkers.find(m => String(m.assetData.id) === String(odpAsset.parent_odc_id));
                        if (parentOdcMarker) {
                            const line = L.polyline.antPath([parentOdcMarker.getLatLng(), odpMarker.getLatLng()], {
                                color: '#ff7800', // Orange
                                weight: 2,
                                opacity: 0.8,
                                delay: 1500, // Slower animation for main connections
                                dashArray: [8, 15], // Longer dashes, more spaced out
                                pulseColor: '#fff', // White pulse
                                hardwareAccelerated: true
                            });
                            line.connectedEntities = { odcId: parentOdcMarker.assetData.id, odpId: odpAsset.id };
                            odpToOdcLines.push(line);
                        }
                    }
                });

            } catch (error) {
                console.error("[loadNetworkAssetMarkers] Error processing assets:", error);
                throw error;
            }
        }

        async function loadCustomerMarkers() {
            console.log("[loadCustomerMarkers] Memulai pemrosesan marker pelanggan (menggunakan data yang sudah ada)...");

            if (!allCustomerData || !Array.isArray(allCustomerData)) {
                console.error("[loadCustomerMarkers] allCustomerData tidak valid atau bukan array.");
                displayGlobalMapMessage("Data pelanggan tidak valid untuk diproses.", "danger", 0);
                allCustomerData = [];
            }

            if (allCustomerData.length === 0) {
                console.warn("[loadCustomerMarkers] Tidak ada data pelanggan untuk diproses.");
                return;
            }

            try {
                for (const customer of allCustomerData) {
                    if (customer.latitude != null && customer.longitude != null) {
                        let lat = parseFloat(customer.latitude);
                        let lng = parseFloat(customer.longitude);
                        if (isNaN(lat) || isNaN(lng)) { console.warn("Koordinat pelanggan tidak valid:", customer); continue; }

                        let onlineStatus = 'unknown';
                        let customerIpAddress = 'N/A';

                        if (customer.pppoe_username) {
                            if (activePppoeUsersMap.has(customer.pppoe_username)) {
                                onlineStatus = 'online';
                                customerIpAddress = activePppoeUsersMap.get(customer.pppoe_username);
                            } else {
                                onlineStatus = 'offline';
                                customerIpAddress = 'Offline';
                            }
                        } else {
                            onlineStatus = 'offline';
                        }

                        if (initialPppoeLoadFailed && customer.pppoe_username) {
                            onlineStatus = 'unknown';
                            customerIpAddress = 'Unknown';
                        }

                        const statusColor = onlineStatus === 'online' ? '#28a745' : (onlineStatus === 'offline' ? '#dc3545' : '#6c757d');

                        let popupContent = `<b>Pelanggan: ${customer.name || 'N/A'}</b><p>ID: ${customer.id}</p>` +
                                         (customer.phone_number ? `<p>No. HP: ${customer.phone_number}</p>` : '<p>No. HP: N/A</p>') +
                                         (customer.address ? `<p>Alamat: ${customer.address}</p>` : '<p>Alamat: N/A</p>') +
                                         `<p>Paket: ${customer.subscription || 'N/A'}</p>` +
                                         `<p>Status Bayar: ${customer.paid ? '<span class="text-success">Lunas</span>' : '<span class="text-danger">Belum</span>'}</p>`+
                                         `<p>Status PPPoE: <span style="font-weight:bold; color:${statusColor}">${onlineStatus.toUpperCase()}</span></p>` +
                                         (customer.pppoe_username ? `<p>PPPoE User: ${customer.pppoe_username}</p>` : '') +
                                         `<p>IP Pelanggan: ${customerIpAddress}</p>`;

                        if (customer.device_id) {
                            popupContent += `<p>Redaman: <span id="redaman-val-${customer.id}">Memuat...</span></p>`;
                            popupContent += `<p>Tipe Modem: <span id="modem-type-${customer.id}">Memuat...</span></p>`;
                        } else {
                            popupContent += '<p>Redaman: <span class="text-muted">N/A (No Device ID)</span></p>';
                            popupContent += '<p>Tipe Modem: <span class="text-muted">N/A (No Device ID)</span></p>';
                        }

                        popupContent += `<p><small>Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}</small></p>`;
                        let odpDetailsHtml = '';
                        let odcDetailsHtml = '';

                        if (customer.connected_odp_id) {
                            const odpMarker = odpMarkers.find(m => String(m.assetData.id) === String(customer.connected_odp_id));
                            if (odpMarker && odpMarker.assetData) {
                                const odpAsset = odpMarker.assetData;
                                const connectedCustomersToThisOdp = allCustomerData.filter(cust => String(cust.connected_odp_id) === String(odpAsset.id));

                                odpDetailsHtml = `<p class="mt-2 pt-2 border-top"><strong><i class="fas fa-network-wired"></i> ODP Terhubung:</strong> ${odpAsset.name || `ID ${odpAsset.id}`}</p>`;

                                if (odpAsset.address) {
                                    odpDetailsHtml += `<p style="margin-left:15px; font-size:0.9em;">Alamat ODP: ${odpAsset.address}</p>`;
                                } else {
                                    odpDetailsHtml += `<p style="margin-left:15px; font-size:0.9em;">Alamat ODP: Tidak tersedia</p>`;
                                }
                                odpDetailsHtml += `<p style="margin-left:15px; font-size:0.9em;">Kapasitas ODP: ${odpAsset.capacity_ports || 'N/A'} Port</p>`;
                                odpDetailsHtml += `<p style="margin-left:15px; font-size:0.9em;">Port Terpakai ODP: ${connectedCustomersToThisOdp.length}</p>`;


                                if (odpAsset.latitude != null && odpAsset.longitude != null) {
                                    const custLatForDist = lat;
                                    const custLngForDist = lng;
                                    const odpAssetLatForDist = parseFloat(odpAsset.latitude);
                                    const odpAssetLngForDist = parseFloat(odpAsset.longitude);

                                    if (!isNaN(custLatForDist) && !isNaN(custLngForDist) && !isNaN(odpAssetLatForDist) && !isNaN(odpAssetLngForDist)) {
                                        const dist = haversineDistance(
                                            { latitude: custLatForDist, longitude: custLngForDist },
                                            { latitude: odpAssetLatForDist, longitude: odpAssetLngForDist }
                                        );
                                        if (!isNaN(dist)) {
                                            odpDetailsHtml += `<p style="margin-left:15px; font-size:0.9em;">Jarak ke ODP: ${dist.toFixed(0)} m</p>`;
                                        }
                                    }
                                }
                                // NEW LOGIC: Differentiate line types based on status
                                if (onlineStatus === 'online') {
                                    // Green, animated dots for the main line
                                    const lineDots = L.polyline.antPath([[lat, lng], odpMarker.getLatLng()], {
                                        color: '#28a745', // Green
                                        weight: 8,
                                        opacity: 1,
                                        delay: 800,
                                        dashArray: [3, 15],
                                        pulseColor: '#fff',
                                        hardwareAccelerated: true
                                    });
                                    lineDots.connectedEntities = { customerId: customer.id, odpId: odpAsset.id };
                                    customerToOdpLines.push(lineDots);

                                    // Bright green, slow pulse for an "active" effect
                                    const linePulse = L.polyline.antPath([[lat, lng], odpMarker.getLatLng()], {
                                        color: '#00FF00',
                                        weight: 6,
                                        opacity: 0.9,
                                        delay: 2500,
                                        dashArray: [30, 100],
                                        pulseColor: '#fff',
                                        hardwareAccelerated: true
                                    });
                                    linePulse.connectedEntities = { customerId: customer.id, odpId: odpAsset.id };
                                    customerToOdpLines.push(linePulse);
                                } else {
                                    // For 'offline' or 'unknown' status, use a calmer, slower animated line with a darker pulse
                                    let lineColor = (onlineStatus === 'offline') ? '#dc3545' : '#6c757d'; // Red for offline, grey for unknown
                                    let pulseColor = (onlineStatus === 'offline') ? '#a92b38' : '#495057'; // Darker pulse color

                                    const offlineLine = L.polyline.antPath([[lat, lng], odpMarker.getLatLng()], {
                                        color: lineColor,
                                        weight: 4,
                                        opacity: 0.8,
                                        delay: 4000, // Even slower animation
                                        dashArray: [10, 20], // Longer dashes, longer gaps
                                        pulseColor: pulseColor, // Use the darker, calmer pulse color
                                        hardwareAccelerated: true
                                    });
                                    offlineLine.connectedEntities = { customerId: customer.id, odpId: odpAsset.id };
                                    customerToOdpLines.push(offlineLine);
                                }

                                if (odpAsset.parent_odc_id) {
                                    const parentOdc = allOdcData.find(o => String(o.id) === String(odpAsset.parent_odc_id));
                                    if (parentOdc) {
                                        odcDetailsHtml = `<p><strong><i class="fas fa-server"></i> Induk ODC:</strong> ${parentOdc.name || `ID ${parentOdc.id}`}</p>`;
                                        if (parentOdc.address) {
                                            odcDetailsHtml += `<p style="margin-left:15px; font-size:0.9em;">Alamat ODC: ${parentOdc.address}</p>`;
                                        } else {
                                             odcDetailsHtml += `<p style="margin-left:15px; font-size:0.9em;">Alamat ODC: Tidak tersedia</p>`;
                                        }
                                        odcDetailsHtml += `<p style="margin-left:15px; font-size:0.9em;">Kapasitas ODC: ${parentOdc.capacity_ports || 'N/A'} Port</p>`;
                                        odcDetailsHtml += `<p style="margin-left:15px; font-size:0.9em;">Port Terpakai ODC: ${parentOdc.ports_used || 0} (ODP)</p>`;
                                    } else {
                                        odcDetailsHtml = `<p><strong><i class="fas fa-server"></i> Induk ODC:</strong> ID ${odpAsset.parent_odc_id} (Detail tidak ditemukan atau ODC tidak difilter)</p>`;
                                    }
                                } else {
                                    odcDetailsHtml = `<p><strong><i class="fas fa-server"></i> Induk ODC:</strong> Tidak terhubung ke ODC.`;
                                }
                            } else {
                                odpDetailsHtml = `<p class="mt-2 pt-2 border-top"><strong><i class="fas fa-network-wired"></i> ODP Terhubung:</strong> ID ${customer.connected_odp_id} (Detail ODP tidak ditemukan/difilter)</p>`;
                            }
                        }
                        popupContent += odpDetailsHtml;
                        popupContent += odcDetailsHtml;

                        if (customer.device_id) {
                            popupContent += `<div class="mt-2"><button class="btn btn-sm btn-info btn-show-wifi-info" data-device-id="${customer.device_id}" data-customer-name="${customer.name||'Pelanggan'}"><i class="fas fa-wifi"></i> Detail Perangkat</button> ` +
                                            `<button class="btn btn-sm btn-warning btn-manage-wifi" data-device-id="${customer.device_id}" data-customer-name="${customer.name||'Pelanggan'}"><i class="fas fa-edit"></i> Kelola WiFi</button></div>`;
                        }
                        
                        const icon = createCustomerStatusIcon(onlineStatus); // Icon only, label is tooltip
                        const marker = L.marker([lat, lng], { icon: icon }).bindPopup(popupContent);
                        marker.customerData = JSON.parse(JSON.stringify(customer));
                        marker.customerOnlineStatus = onlineStatus;
                        marker.customerIpAddress = customerIpAddress;

                        // Bind tooltip for customer
                        let customerLabel = customer.pppoe_username || customer.name || `Cust. ID ${customer.id}`;
                        marker.bindTooltip(customerLabel, {
                            permanent: true, // Always show unless hidden by control
                            direction: 'top',
                            className: 'marker-label-tooltip', // Apply custom styling to tooltip
                            offset: [0, -ICON_HEIGHT/2 - 5] // Offset to position above icon
                        });
                        // Set initial visibility
                        if (!labelVisibility.customer) {
                            marker.getTooltip().setOpacity(0);
                        }

                        marker.on('popupopen', function(e) {
                            updateCustomerPopupDetails(e.target, e.target.customerData);
                        });

                        customerMarkers.push(marker);
                    }
                }
            } catch(processingError) {
                console.error("[loadCustomerMarkers] Error processing customer data for markers:", processingError);
                displayGlobalMapMessage("Gagal memproses data pelanggan untuk ditampilkan di peta. Cek konsol.", "danger", 0);
                throw processingError;
            }
        }

        $(document).on('click', '.btn-edit-asset', function(e) {
            e.stopPropagation();
            const activePopup = map ? map._popup : null;
            if (activePopup && activePopup._source && activePopup._source.assetData) {
                const assetDataForModal = JSON.parse(JSON.stringify(activePopup._source.assetData));
                openAssetModal(assetDataForModal, null, null); 
                if (map) map.closePopup();
            }
        });

        $(document).on('click', '.btn-show-wifi-info', async function(e) {
            e.stopPropagation();
            if (map && map._popup && map._popup.isOpen()) map.closePopup();

            const deviceId = $(this).data('device-id');
            let customerName = $(this).data('customer-name') || "Pelanggan";
            const popupContentElement = $(this).closest('.leaflet-popup-content');
            if (popupContentElement.length > 0) {
                const nameFromPopup = popupContentElement.find('b').first().text().replace('Pelanggan: ','').trim();
                if (nameFromPopup && nameFromPopup !== 'N/A') customerName = nameFromPopup;
            }

            $('#wifiInfoModalLabel').text(`Detail Perangkat & WiFi untuk ${customerName}`);
            const modalBody = $('#wifiInfoModalBody');
            modalBody.html('<p class="text-center my-3"><i class="fas fa-spinner fa-spin fa-2x"></i><br>Memuat informasi...</p>');
            $('#wifiInfoModal').modal('show');

            let deviceDetailsContent = '';
            if (deviceId) {
                try {
                    const response = await fetch(`/api/device-details/${deviceId}?_=${new Date().getTime()}`);
                    if (!response.ok) {
                         console.warn(`Gagal mengambil detail perangkat untuk modal (${deviceId}): ${response.status}`);
                         deviceDetailsContent += `<p class="mb-1"><strong><i class="fas fa-microchip"></i> Tipe Modem:</strong> Tidak tersedia (Server Error)</p>`;
                    } else {
                        const result = await response.json();
                        if (result.data && result.data.modemType) {
                            deviceDetailsContent += `<p class="mb-1"><strong><i class="fas fa-microchip"></i> Tipe Modem:</strong> ${result.data.modemType}</p>`;
                        } else {
                            deviceDetailsContent += `<p class="mb-1"><strong><i class="fas fa-microchip"></i> Tipe Modem:</strong> Tidak terdeteksi/N/A</p>`;
                        }
                    }
                } catch (devError) {
                    console.error("Error fetching device details for modal:", devError);
                    deviceDetailsContent += `<p class="mb-1"><strong><i class="fas fa-microchip"></i> Tipe Modem:</strong> Error saat memuat</p>`;
                }
            } else {
                 deviceDetailsContent += `<p class="mb-1"><strong><i class="fas fa-microchip"></i> Tipe Modem:</strong> N/A (No Device ID)</p>`;
            }


            try {
                const response = await fetch(`/api/customer-wifi-info/${deviceId}?_=${new Date().getTime()}`);
                const result = await response.json();
                if (!response.ok || result.status !== 200) throw new Error(result.message || `Gagal ambil info WiFi (HTTP ${response.status})`);

                if (result.data && Array.isArray(result.data.ssid)) {
                    let content = deviceDetailsContent;
                    content += `<p class="mb-2"><strong><i class="fas fa-clock"></i> Uptime Modem (dari WiFi API):</strong> ${result.data.uptime || 'N/A'}</p><hr class="mt-1 mb-3">`;
                    if (result.data.ssid.length > 0) {
                        content += `<h5><i class="fas fa-wifi"></i> Daftar SSID</h6>`;
                        result.data.ssid.forEach(s => {
                            if (!s || typeof s !== 'object') return;
                            content += `<div class="card mb-3 shadow-sm"><div class="card-header py-2"><strong>SSID ${s.id||'N/A'}: <span class="text-primary font-weight-bold">${s.name||'N/A'}</span></strong></div>`+
                                       `<div class="card-body py-2 px-3"><p class="mb-1 small"><strong>Transmit Power:</strong> ${s.transmitPower != null ? s.transmitPower + '%' : 'N/A'}</p>`;
                            if (s.associatedDevices && s.associatedDevices.length > 0) {
                                content += `<p class="mb-1 small mt-2"><strong><i class="fas fa-users"></i> Perangkat Terhubung (${s.associatedDevices.length}):</strong></p><ul class="list-group list-group-flush device-list small">`;
                                s.associatedDevices.forEach(dev => {
                                     if (!dev || typeof dev !== 'object') return;
                                    content += `<li class="list-group-item py-1 px-0">${dev.hostName||'Tanpa Nama'} <br><small class="text-muted" style="font-size:0.9em;">(MAC: ${dev.mac||'-'}, IP: ${dev.ip||'-'}, Sinyal: ${dev.signal ? dev.signal+' dBm':'-'})</small></li>`;
                                });
                                content += `</ul>`;
                            } else content += `<p class="mb-1 small mt-2"><em>Tidak ada perangkat terhubung.</em></p>`;
                            content += `</div></div>`;
                        });
                    } else content += '<p class="text-muted">Tidak ada SSID aktif ditemukan.</p>';
                    modalBody.html(content);
                } else modalBody.html(deviceDetailsContent + '<p class="text-danger">Format data API WiFi tidak sesuai.</p>');
            } catch (error) {
                modalBody.html(deviceDetailsContent + `<p class="text-danger"><strong>Error memuat info WiFi:</strong> ${error.message}</p>`);
            }
        });

        $(document).on('click', '.btn-manage-wifi', async function(e) {
            e.stopPropagation();
            if (map && map._popup) map.closePopup();

            const deviceId = $(this).data('device-id');
            let customerName = $(this).data('customer-name') || "Pelanggan";
             const popupContentElement = $(this).closest('.leaflet-popup-content');
             if (popupContentElement.length > 0) {
                const nameFromPopup = popupContentElement.find('b').first().text().replace('Pelanggan: ','').trim();
                if (nameFromPopup && nameFromPopup !== 'N/A') customerName = nameFromPopup;
             }

            $('#wifi_manage_device_id').val(deviceId);
            $('#wifi_manage_customer_name').val(customerName);
            $('#wifiManagementModalLabel').text(`Kelola WiFi untuk ${customerName}`);
            const formContainer = $('#wifiManagementFormContainer');
            formContainer.html('<p class="text-center my-3"><i class="fas fa-spinner fa-spin fa-2x"></i><br>Memuat...</p>');
            $('#wifi_manage_transmit_power').val('');
            $('#wifiManagementModal').modal('show');

            try {
                const response = await fetch(`/api/customer-wifi-info/${deviceId}?_=${new Date().getTime()}`);
                const result = await response.json();
                if (!response.ok || result.status !== 200 ) throw new Error(result.message || `Gagal ambil data SSID (HTTP ${response.status})`);

                if (result.data && result.data.ssid && Array.isArray(result.data.ssid)) {
                    let formContent = '';
                    if (result.data.ssid.length > 0) {
                        result.data.ssid.forEach(s => {
                            if(!s || typeof s !== 'object') return;
                            formContent += `<div class="card card-body mb-2 p-2 shadow-sm">
                                <p class="mb-1"><strong>SSID ID: ${s.id} (Nama: <span class="text-info font-weight-bold">${s.name||'N/A'}</span>)</strong></p>
                                <div class="form-group mb-2"><label for="wifi_manage_ssid_name_${s.id}" class="form-label mb-0">Nama SSID Baru</label><input type="text" class="form-control form-control-sm" id="wifi_manage_ssid_name_${s.id}" name="ssid_${s.id}" placeholder="Kosong jika tidak diubah"></div>
                                <div class="form-group mb-1"><label for="wifi_manage_ssid_password_${s.id}" class="form-label mb-0">Password Baru</label><input type="password" class="form-control form-control-sm" id="wifi_manage_ssid_password_${s.id}" name="ssid_password_${s.id}" placeholder="Min. 8 karakter, kosong jika tidak diubah"></div>
                                </div>`;
                          credentials: 'include', // ✅ Fixed by script
                        });
                    } else formContent = '<p class="text-muted">Tidak ada SSID terkonfigurasi.</p>';
                    formContainer.html(formContent);
                    if(result.data.ssid.length > 0 && result.data.ssid[0].transmitPower != null) {
                        $('#wifi_manage_transmit_power').val(result.data.ssid[0].transmitPower);
                    }
                } else formContainer.html('<p class="text-danger">Format data API tidak sesuai.</p>');
            } catch (error) {
                formContainer.html(`<p class="text-danger">Error: ${error.message}</p>`);
            }
        });

        $('#wifiManagementForm').on('submit', async function(event) {
            event.preventDefault();
            const deviceId = $('#wifi_manage_device_id').val();
            const customerName = $('#wifi_manage_customer_name').val();
            const formData = new FormData(this);
            const dataToSend = {};
            let hasChanges = false;
            formData.forEach((value, key) => {
                if (value && value.trim() !== '') {
                    dataToSend[key] = value.trim();
                    if (!['device_id_for_wifi_manage', 'customer_name_for_wifi_manage'].includes(key)) hasChanges = true;
                }
            });
            delete dataToSend.device_id_for_wifi_manage;
            delete dataToSend.customer_name_for_wifi_manage;

            if (!hasChanges) {
                displayGlobalMapMessage('Tidak ada perubahan dimasukkan.', 'info');
                $('#wifiManagementModal').modal('hide'); return;
            }

            const saveButton = $('#saveWifiManagementBtn');
            const originalButtonText = saveButton.html();
            saveButton.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Menyimpan...');

            try {
                const response = await fetch(`/api/ssid/${deviceId}`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(dataToSend) });
                const result = await response.json();
                if (response.ok && result.status === 200) {
                    displayGlobalMapMessage(`Perubahan WiFi untuk ${customerName} berhasil dikirim.`, 'success');
                    $('#wifiManagementModal').modal('hide');
                } else displayGlobalMapMessage(`Gagal simpan: ${result.message || `Status ${response.status}`}`, 'danger');
            } catch (error) {
                displayGlobalMapMessage(`Error koneksi: ${error.message}`, 'danger');
            } finally {
                saveButton.prop('disabled', false).html(originalButtonText);
            }
          credentials: 'include', // ✅ Fixed by script
        });


        document.addEventListener('DOMContentLoaded', function() {
            console.log("[DOMReady] DOM fully loaded. Initializing application...");
            
            // Start with sidebar collapsed for more map space on desktop
            if (window.innerWidth >= 768) {
                $('body').addClass('sidebar-toggled');
                $('.sidebar').addClass('toggled');
            }
            
            try {
                initializeMap();
            } catch(e) {
                console.error("[DOMReady] FATAL ERROR during initializeMap:", e);
                 $('#interactiveMap').html('<div class="alert alert-danger text-center"><strong>Peta Gagal Dimuat!</strong> Error kritis. Cek konsol.</div>');
            }

            $('#manualFullscreenBtn').on('click', toggleFullScreenManual);

            $('#yesAddOdpBtn').on('click', async function() {
                const parentOdcId = this.getAttribute('data-odc-id');
                const lat = parseFloat(this.getAttribute('data-lat'));
                const lng = parseFloat(this.getAttribute('data-lng'));
                $('#addOdpAfterOdcModal').modal('hide');
                openAssetModal(null, lat, lng); 
                setTimeout(() => {
                    $('#assetType').val('ODP').trigger('change');
                    setTimeout(() => { 
                        $('#assetParentOdc').val(parentOdcId).trigger('change.select2');
                        $('#useParentOdcLocation').prop('checked', true).trigger('change');
                        const parentOdcAsset = allNetworkAssetsData.find(odc => odc.type === 'ODC' && odc.id == parentOdcId);
                        const parentOdcName = parentOdcAsset ? parentOdcAsset.name : `ODC-${parentOdcId}`;
                        const existingOdps = allNetworkAssetsData.filter(a => a.type === 'ODP' && a.parent_odc_id == parentOdcId &&
                                                Math.abs(parseFloat(a.latitude) - lat) < 0.00001 && Math.abs(parseFloat(a.longitude) - lng) < 0.00001).length;
                        $('#assetName').val(`${parentOdcName} - ODP ${String(existingOdps + 1).padStart(2, '0')}`).focus();
                    }, 150);
                }, 50);
            });

            $('#noAddOdpBtn').on('click', () => {
                $('#addOdpAfterOdcModal').modal('hide');
                displayGlobalMapMessage('ODC berhasil disimpan.', 'success');
            });

            $('#refreshAllDataBtn').on('click', async function() {
                if (!map) { displayGlobalMapMessage("Peta belum siap.", "warning"); return; }
                const button = $(this);
                const originalHtml = button.html();
                button.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Refreshing...');

                await loadAllMapData();

                let msg = `Refresh data selesai.`;
                 if (initialPppoeLoadFailed) {
                    msg = `Refresh selesai, namun pengambilan status PPPoE gagal.`;
                    displayGlobalMapMessage(msg, "warning", 10000);
                } else {
                    displayGlobalMapMessage(msg, "success", 7000);
                }

                button.prop('disabled', false).html(originalHtml);
            });

            const AUTO_REFRESH_INTERVAL_MS = 30000; // 30 detik
            $('#autoRefreshToggle').on('change', function() {
                if ($(this).is(':checked')) {
                    if (autoRefreshIntervalId) clearInterval(autoRefreshIntervalId);

                    const runAutoRefresh = async () => {
                        console.log(`[AutoRefresh] Running automatic data refresh at ${new Date().toLocaleTimeString()}`);
                        const refreshBtn = $('#refreshAllDataBtn');
                        if (refreshBtn.prop('disabled')) {
                            console.log('[AutoRefresh] Skipping as a manual refresh is already in progress.');
                            return;
                        }
                        
                        await loadAllMapData(); 
                        console.log('[AutoRefresh] Automatic data refresh finished.');
                    };

                    runAutoRefresh();
                    autoRefreshIntervalId = setInterval(runAutoRefresh, AUTO_REFRESH_INTERVAL_MS);
                    
                    const label = $(this).next('label');
                    displayGlobalMapMessage(`Auto refresh diaktifkan setiap ${AUTO_REFRESH_INTERVAL_MS / 1000} detik.`, 'info', 5000);
                    label.attr('title', `Nonaktifkan refresh data otomatis (interval ${AUTO_REFRESH_INTERVAL_MS / 1000} detik)`);

                } else {
                    if (autoRefreshIntervalId) {
                        clearInterval(autoRefreshIntervalId);
                        autoRefreshIntervalId = null;
                        console.log('[AutoRefresh] Stopped.');
                        displayGlobalMapMessage('Auto refresh dinonaktifkan.', 'info', 5000);
                        $(this).next('label').attr('title', 'Aktifkan refresh data otomatis setiap 30 detik');
                    }
                }
            });

            console.log("[DOMReady] Event listeners and page setup complete.");
        });
    </script>
</body>
</html>