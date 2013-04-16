<?php

// the base class to return data in JSON for aciTree
// as you can see, keep it simple it's the best way to do things :D
// note: you'll need PHP >= 5.2 to run this

abstract class Tree {

    /**
     * Get tree branch as KEY => ITEM.
     * @param string $parentId - if NULL then it's the root
     * @return array
     */
    abstract public function branch($parentId = null);

    /**
     * Get item properties (all default properties must be defined).
     * @param string $itemId
     * @return array
     */
    public function itemProps($itemId) {
        return array(
            'isFolder' => null, // NULL = maybe a folder, TRUE - is a folder, FALSE - it's not a folder
            'open' => false, // should open folder?
            'icon' => null // icon CSS class name (if any) can be ARRAY [name, background X, background Y] (in this order)
        );
    }

    private function _json($parentId, Array &$json, $children) {
        $branch = $this->branch($parentId);
        foreach ($branch as $id => $label) {
            $props = $this->itemProps($id);
            $childs = array();
            if ($children) {
                $this->_json($id, $childs, $children);
                if (count($childs) == 0) {
                    $props['isFolder'] = false;
                }
            }
            $json[] = array_merge(array(
                'id' => $id,
                'label' => $label,
                'childs' => $childs
            ), $props);
        }
    }

    /**
     * Output tree JSON (array of id/item/props/items with props.isFolder depending if it's a TREE folder or not).
     * @param string $parentId
     * @param bool $children - include children?
     */
    public function json($parentId, $children = false) {
        $json = array();
        $this->_json($parentId, $json, $children);
        header('Content-type: application/json; charset=UTF-8');
        header('Vary: Accept-Encoding');
        echo json_encode($json);
        die;
    }

}
