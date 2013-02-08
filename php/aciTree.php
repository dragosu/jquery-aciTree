<?php

// get the Tree JSON data ...

$path = dirname(__FILE__);

require_once("$path/Tree.php");
require_once("$path/FsTree.php");

$fsTree = new FsTree(new Fs("$path/tree"));

$branch = isset($_GET['branch']) ? $_GET['branch'] : null;

// special case for 1k test ...
if ((strpos($branch, 'a_new_File_ID') !== false) || (strpos($branch, 'a_new_Folder_ID') !== false)) {
    // burn your CPU not the server with the 1k entries ... ;))
    if (preg_match('@[0-9]+$@', $branch, $match) == 1) {
        if ((int) $match[0] > 20) {
            die('[]');
        }
    }
    sleep(1);
    die('[]');
}

if (strpos($branch, '..') !== false) {
    // path should not have a [..] ;-)
    $branch = 'undefined';
}

// a small delay so we can see the loading animation
sleep(1);

// no cache so we can see the loading animation :)
header('Expires: Mon, 26 Jul 1997 05:00:00 GMT');
header('Last-Modified: ' . gmdate('D, d M Y H:i:s') . ' GMT');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Cache-Control: post-check=0, pre-check=0', false);
header('Pragma: no-cache');

$fsTree->json($branch);
