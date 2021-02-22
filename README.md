## 针对项目需求，借鉴 kms-jsmind库的实现进行修改

## 安装依赖，用于打包项目 gulp
1. npm install

## 打包前资源访问页面, 直接访问index.html

## 打包后资源访问页面
2. gulp

## 将项目地址修改为打包后资源
    <link rel="stylesheet" type="text/css" href="./dist/kmsjsmap.min.css">
    <!-- <link rel="stylesheet" type="text/css" href="./src/kmsjsmap.css" /> -->
    <script src="./dist/kmsjsmap.min.js" type="text/javascript"></script>
    <!-- <script src="./src/kmsjsmap.js" type="text/javascript"></script> -->

## 注意事项：
1. 打包过程中如果存在dist文件，会打包失败，需要删除dist文件，再打包。