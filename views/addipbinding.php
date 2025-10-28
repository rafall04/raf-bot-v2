<?php
header("Content-Type:application/json");
require('conn.php');

if(!empty($_GET['comment']))
if(!empty($_GET['ip']))
if(!empty($_GET['mac']))
{
	$comment=$_GET['comment'];
    $ip=$_GET['ip'];
    $mac=$_GET['mac'];

define('ip', "$ip");
define('mac', "$mac");
define('type', 'bypassed');
{
    // Data user dan password hotspot
    $user = array(1 => array('name' => "$comment"),
                  );
 
    foreach($user as $tmp)
    {
        $comment="=comment=";
        $comment.=$tmp['name'];

        $ip="=address=";
        $ip.=ip;
 
        $toip="=to-address=";
        $toip.=ip;
 
        $mac="=mac-address=";
        $mac.=mac;

        $type="=type=";
        $type.=type;
 
        $API->write('/ip/hotspot/ip-binding/add',false);
        $API->write($comment, false);
        $API->write($ip, false);
        $API->write($toip, false);
        $API->write($mac, false);
        $API->write($type);
 
        $READ = $API->read(false);
        $hasil = json_encode($READ);
        // echo $hasil;

        if ($hasil == '["!trap","=message=failure: such client already exists","!done"]') {
            echo "ERROR !!! IP ATAU MAC DI IP BINDING SUDAH TERDAFTAR DI MIKROTIK";
        } else if ($hasil == '["!trap","=message=value of address expects range of ip addresses","!done"]') {
            echo "ERROR !!! RANGE IP MELEWATI BATAS YANG TELAH DITENTUKAN";
        } else if ($hasil == '["!trap","=message=invalid value of mac-address, mac address required","!done"]') {
            echo "ERROR !!! INVALID MAC ADDRESS";
        } else {
            echo "SUKSES";
        }


    }
    $API->disconnect();
}
}	