<?php
header("Content-Type:application/json");
require('conn.php');

if(!empty($_GET['comment']))
if(!empty($_GET['name']))
if(!empty($_GET['target']))
if(!empty($_GET['parent']))
if(!empty($_GET['limitat']))
if(!empty($_GET['maxlimit']))
{
	$comment=$_GET['comment'];
    $name=$_GET['name'];
    $target=$_GET['target'];
	$parent=$_GET['parent'];
    $limitat=$_GET['limitat'];
    $maxlimit=$_GET['maxlimit'];

define('COMMENT', "$comment");
define('TARGET', "$target");
define('PARENT', "$parent");
define('LIMITAT', "$limitat");
define('MAXLIMIT', "$maxlimit");
{
    // Data user dan password hotspot
    $user = array(1 => array('name' => "$name"),
                  );
 
    foreach($user as $tmp)
    {
        $comment="=comment=";
        $comment.=COMMENT;

        $username="=name=";
        $username.=$tmp['name'];

        $target="=target=";
        $target.=TARGET;
 
        $parent="=parent=";
        $parent.=PARENT;

        $limitat="=limit-at=";
        $limitat.=LIMITAT;
 
        $maxlimit="=max-limit=";
        $maxlimit.=MAXLIMIT;
 
        $API->write('/queue/simple/add',false);
        $API->write($username, false);
        $API->write($target, false);
        $API->write($parent, false);
        $API->write($limitat, false);
        $API->write($comment, false);
        $API->write($maxlimit);
 
        $READ = $API->read(false);
        $hasil = json_encode($READ);
        // echo $hasil;

        if ($hasil == '["!trap","=message=input does not match any value of parent","!done"]') {
            echo "ERROR !!! PARENT TIDAK DITEMUKAN DI MIKROTIK";
        } else if ($hasil == '["!trap","=message=failure: already have such name","!done"]') {
            echo "ERROR !!! NAMA SIMPLE QUEUE SUDAH TERDAFTAR DI MIKROTIK";
        } else if ($hasil == '["!trap","=message=failure: upload-max-limit less than upload-limit","!done"]') {
            echo "ERROR !!! CEK PADA KONFIG UPLOAD ANDA.";
        } else if ($hasil == '["!trap","=message=failure: download-max-limit less than download-limit","!done"]') {
            echo "ERROR !!! CEK PADA KONFIG DOWNLOAD ANDA.";
        } else if ($hasil == '') {
            echo "ERROR !!! SILAHKAN HUBUNGI PEMBUAT BOT";
        } else {
            echo "SUKSES";
        }


    }
    $API->disconnect();
}
}	