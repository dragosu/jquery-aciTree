<?php

// a sample class to show file system based aciTree
// note: a simple file system helper class is at the end of this file

class FsTree extends Tree {

    private $fs = null;

    public function __construct(Fs $fs) {
        $this->fs = $fs;
    }

    /*
     * $parentId will be the path to the folder.
     */

    public function branch($parentId = null) {
        $branch = array();
        $list = $this->fs->folders($parentId);
        foreach ($list as $entry) {
            $branch["$parentId/$entry"] = $entry;
        }
        $list = $this->fs->files($parentId);
        foreach ($list as $entry) {
            $branch["$parentId/$entry"] = $entry;
        }
        return $branch;
    }

    /**
     * Return TRUE if it's a TREE folder (have children).
     * @param string $path
     * @param string $icon - item icon
     */
    private function hasChildren($path, &$icon) {
        if (is_dir($path)) {
            $icon = 'folder';
            // here we can return NULL instead of checking for children
            // return null;
            return !$this->fs->isEmpty($path);
        } else {
            $icon = 'file';
            return false;
        }
    }

    /*
     * $itemId will be the path to the file/folder.
     */

    public function itemProps($itemId) {
        $itemId = trim($itemId, '/\\');
        if ($this->fs->allow($itemId, $real)) {
            return array_merge(parent::itemProps($itemId), array(
                        'inode' => $this->hasChildren($real, $icon),
                        'icon' => $icon,
                        'random' => mt_rand(0, 99) // just a random property
                    ));
        }
        return parent::itemProps($itemId);
    }

}

// a file system helper for getting file system folders/files
// and for limiting the listings to the base folder

class Fs {

    // keep the base folder
    private $base = null;

    public function __construct($base) {
        $this->base($base);
    }

    /**
     * Set/Get the base folder.
     * @param string $base
     * @return string
     */
    public function base($base = null) {
        if ($base === null) {
            return $this->base;
        } else {
            $this->base = realpath($base);
        }
    }

    /**
     * Check if $path is under $this->base.
     * @param string $path - relative path
     * @param string $real - absolute path
     * @return bool
     */
    public function allow($path, &$real = null) {
        $real = realpath("$this->base/$path");
        return strpos($real, $this->base) === 0;
    }

    /**
     * Get a list of folders.
     * @param string $path - relative path
     * @return array
     */
    public function folders($path) {
        $list = array();
        if ($this->allow($path, $path) && is_dir($path)) {
            $handle = opendir($path);
            if ($handle) {
                while ($entry = readdir($handle)) {
                    if (($entry != '.') && ($entry != '..') && is_dir("$path/$entry")) {
                        $list[] = $entry;
                    }
                }
                closedir($handle);
            }
        }
        asort($list);
        return $list;
    }

    /**
     * Check if a folder is empty.
     * @param string $path - absolute path
     * @return boolean
     */
    public function isEmpty($path) {
        $handle = opendir($path);
        if ($handle) {
            while ($entry = readdir($handle)) {
                if (($entry != '.') && ($entry != '..')) {
                    closedir($handle);
                    return false;
                }
            }
            closedir($handle);
        }
        return true;
    }

    /**
     * Get a list of files.
     * @param string $path - relative path
     * @return array
     */
    public function files($path) {
        $list = array();
        if ($this->allow($path, $path) && is_dir($path)) {
            $handle = opendir($path);
            if ($handle) {
                while ($entry = readdir($handle)) {
                    if (($entry != '.') && ($entry != '..') && is_file("$path/$entry")) {
                        $list[] = $entry;
                    }
                }
                closedir($handle);
            }
        }
        asort($list);
        return $list;
    }

}
