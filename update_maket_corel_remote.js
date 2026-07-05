let currentMaketEvt = null;
let currentMaketDateStr = null;
let currentMaketObjects = [];
let currentActiveObjectId = null;
let currentMaketEvtContent = "";
let currentMaketFormattedDate = "";
let currentActiveBgId = "";
let currentActiveBgUrl = "";
let availableBgs = [];

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, function(tag) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag;
    });
}

window.openMaketModal = function(eventId, evtContent) {
    currentMaketEvt = { Id: eventId, Content: evtContent };
    currentMaketDateStr = ""; 
    
    if (document.getElementById('maketModal')) {
        document.getElementById('maketModal').remove();
    }

    // In remote app, globalSettings is the config
    let c = Object.assign({}, window.globalSettings || {});
    availableBgs = c.Backgrounds || [];
    currentActiveBgId = c.DefaultBackgroundId || '';
    
    // Set active bg url
    currentActiveBgUrl = '';
    let selectedBg = availableBgs.find(b => b.Id == currentActiveBgId);
    if (selectedBg) currentActiveBgUrl = selectedBg.FileName.startsWith('/') ? '.' + selectedBg.FileName : selectedBg.FileName;

    // Load Maket Objects from remote settings default
    currentMaketObjects = [];
    if (c.MaketObjects && c.MaketObjects.length > 0) {
        currentMaketObjects = JSON.parse(JSON.stringify(c.MaketObjects)); // Deep copy
        
        // Patch legacy global objects that lack coordinates
        currentMaketObjects.forEach((o, i) => {
            if (o.OffsetY === undefined || o.OffsetY === 0) {
                if (i === 0) { o.OffsetY = 96; }
                else if (i === 1) { o.OffsetY = 250; }
                else if (i === 2) { o.OffsetY = 518; }
                else if (i === 3) { o.OffsetY = 922; }
            }
        });
    }

    // Prepare Event Tokens
    currentMaketEvtContent = evtContent;
    if (evtContent && evtContent.toLowerCase().startsWith('họp')) {
        currentMaketEvtContent = evtContent.substring(3).trim();
        currentMaketEvtContent = currentMaketEvtContent.charAt(0).toUpperCase() + currentMaketEvtContent.slice(1);
    }

    // Load saved local adjustments for this event from globalMaketDetails
    if (window.globalMaketDetails && window.globalMaketDetails[eventId]) {
        let sl = window.globalMaketDetails[eventId];
        if (sl.MaketObjects) currentMaketObjects = JSON.parse(JSON.stringify(sl.MaketObjects));
        if (sl.activeBgId) {
            currentActiveBgId = sl.activeBgId;
            let b = availableBgs.find(x => x.Id == currentActiveBgId);
            if (b) currentActiveBgUrl = b.FileName.startsWith('/') ? '.' + b.FileName : b.FileName;
        }
    }

    let modal = document.createElement('div');
    modal.id = 'maketModal';
    modal.style.position = 'fixed';
    modal.style.top = '0'; modal.style.left = '0';
    modal.style.width = '100%'; modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.85)';
    modal.style.zIndex = '9999';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.padding = '10px';
    modal.style.boxSizing = 'border-box';

    let bgListHtml = availableBgs.map(bg => {
        let imgUrl = bg.FileName.startsWith('/') ? '.' + bg.FileName : bg.FileName;
        return `
        <div class="bg-item-select" data-id="${bg.Id}" data-url="${imgUrl}" style="cursor:pointer; border:3px solid ${bg.Id == currentActiveBgId ? '#4caf50' : 'transparent'}; border-radius:6px; padding:2px; transition:0.2s; position:relative; margin-bottom: 8px;" onclick="window.selectBackground('${bg.Id}', '${imgUrl}')">
            <img src="${imgUrl}" style="width:100%; height:80px; object-fit:cover; border-radius:4px; display:block;" onerror="this.src='./backgrounds/default.jpg'">
        </div>`;
    }).join('');

    modal.innerHTML = `
        <div style="background:#fff; border-radius:8px; width:100%; max-width:1600px; height: 95vh; display:flex; flex-direction:column; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
            <div style="padding:15px 20px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; font-size:18px;">Sửa Maket Nâng Cao (Chuẩn Đồ họa)</h3>
                <button type="button" onclick="document.getElementById('maketModal').remove()" style="background:none; border:none; font-size:28px; cursor:pointer; color:#999; line-height:1; padding:0 5px;" title="Đóng">&times;</button>
            </div>
            
            <div style="flex:1; overflow:hidden; display:flex; flex-direction: column;">
                <!-- Preview & Text Edit -->
                <div style="display:flex; flex-direction:column; padding:10px; background:#f0f2f5;">
                    <div id="preview-container" style="width:100%; aspect-ratio:16/9; background:#000; position:relative; overflow:hidden; border-radius:6px; margin-bottom:10px; box-shadow:0 4px 12px rgba(0,0,0,0.3);">
                        <div id="preview-board" style="width:1920px; height:1080px; position:absolute; top:0; left:0; transform-origin:0 0; background-size:cover; background-position:center;">
                        </div>
                    </div>
                    
                    <div style="display:flex; flex-direction:column;">
                          <label style="font-weight:bold; font-size:12px; color:#333; margin-bottom:5px;">Nội dung của Đối tượng đang chọn: <span id="prop-xy-display" style="color:red; font-weight:normal; font-size:12px; margin-left:10px;"></span></label>
                          <textarea id="edit-main-textarea" oninput="window.updateActiveText(this.value)" disabled placeholder="Chọn một đối tượng trong tab Thuộc tính để sửa..." style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px; font-family:inherit; resize:none; font-size: 14px; background: #fff; height: 60px;"></textarea>
                    </div>
                </div>
                
                <!-- Tabs (Backgrounds & Properties) -->
                <div style="flex:1; border-top:1px solid #eee; display:flex; flex-direction:column; background:#fff; overflow:hidden;">
                    <div style="display:flex; border-bottom:1px solid #ddd; background:#f8f9fa;">
                        <div id="tab-bg" onclick="window.switchTab('bg')" style="flex:1; text-align:center; padding:10px; font-weight:bold; cursor:pointer; color:#555; border-bottom:2px solid transparent; font-size: 14px;">🎨 Hình nền</div>
                        <div id="tab-prop" onclick="window.switchTab('prop')" style="flex:1; text-align:center; padding:10px; font-weight:bold; cursor:pointer; color:#0d6efd; border-bottom:2px solid #0d6efd; font-size: 14px;">⚙️ Thuộc tính</div>
                    </div>
                    
                    <div id="tab-content-bg" style="display:none; flex:1; overflow-y:auto; padding:10px;">
                        ${bgListHtml}
                    </div>

                    <div id="tab-content-prop" style="display:flex; flex-direction:column; flex:1; overflow:hidden;">
                        <!-- Property Settings -->
                        <div id="edit-property-panel" style="padding:10px; border-bottom:2px solid #eee; background:#fdfdfd; opacity:0.5; pointer-events:none; overflow-y:auto; flex:1;">
                            <div style="font-weight:bold; font-size:12px; color:#dc3545; margin-bottom:10px;" id="prop-panel-title">Chưa chọn đối tượng</div>
                            
                            <input id="prop-name" type="hidden">
                            
                            <div style="display:flex; gap:5px; margin-bottom:5px;">
                                <div style="flex:2;">
                                    <label style="font-size:11px; color:#555; display:block; margin-bottom:3px;">Font</label>
                                    <select id="prop-font" onchange="window.updateObjectProperty('Font', this.value)" style="width:100%; padding:6px; border:1px solid #ccc; border-radius:4px; font-size:12px;">
                                        <option value="'Inter', sans-serif">Inter</option>
                                        <option value="Times New Roman">Times New Roman</option>
                                        <option value="Arial">Arial</option>
                                    </select>
                                </div>
                                <div style="flex:1;">
                                    <label style="font-size:11px; color:#555; display:block; margin-bottom:3px;">Cỡ (pt)</label>
                                    <input id="prop-size" oninput="window.updateObjectProperty('FontSize', this.value)" type="number" style="width:100%; padding:4px; border:1px solid #ccc; border-radius:4px;">
                                </div>
                            </div>

                            <div style="display:flex; gap:10px; margin-bottom:10px; align-items:center;">
                                <!-- Align group -->
                                <div style="display:flex; gap:2px; align-items:center; border:1px solid #ccc; border-radius:4px; padding:2px;">
                                    <button title="Căn trái" id="btn-align-left" onclick="window.updateObjectProperty('Align', 'left')" style="background:none; border:none; padding:2px 4px; cursor:pointer; border-radius:3px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="15" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="15" y2="18"></line></svg></button>
                                    <button title="Căn giữa" id="btn-align-center" onclick="window.updateObjectProperty('Align', 'center')" style="background:none; border:none; padding:2px 4px; cursor:pointer; border-radius:3px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="6" y1="18" x2="18" y2="18"></line></svg></button>
                                    <button title="Căn phải" id="btn-align-right" onclick="window.updateObjectProperty('Align', 'right')" style="background:none; border:none; padding:2px 4px; cursor:pointer; border-radius:3px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="9" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="9" y1="18" x2="21" y2="18"></line></svg></button>
                                </div>
                                
                                <!-- Case dropdown -->
                                <div style="position:relative; display:inline-block; border:1px solid #ccc; border-radius:4px; padding:2px 6px; cursor:pointer;" title="Kiểu chữ">
                                    <div style="display:flex; align-items:center; gap:2px; pointer-events:none;">
                                        <span style="font-family:serif; font-size:14px; font-weight:bold; line-height:1;">Aa</span>
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                    </div>
                                    <select id="prop-case" onchange="window.updateObjectProperty('TextCase', this.value)" style="position:absolute; top:0; left:0; width:100%; height:100%; opacity:0; cursor:pointer;">
                                        <option value="none">Bình thường</option>
                                        <option value="uppercase">IN HOA</option>
                                        <option value="lowercase">in thường</option>
                                    </select>
                                </div>
                                
                                <!-- Text Color -->
                                <div style="position:relative; display:inline-block; cursor:pointer; border:1px solid #ccc; border-radius:4px; padding:2px 6px;" title="Màu chữ">
                                    <div style="display:flex; flex-direction:column; align-items:center; pointer-events:none; gap:1px;">
                                        <span style="font-family:serif; font-size:13px; font-weight:bold; line-height:1;">A</span>
                                        <div id="prop-color-bar" style="width:14px; height:3px; background:#000; border-radius:1px;"></div>
                                    </div>
                                    <input id="prop-color" oninput="window.updateObjectProperty('Color', this.value); document.getElementById('prop-color-bar').style.background=this.value;" type="color" style="position:absolute; top:0; left:0; width:100%; height:100%; opacity:0; cursor:pointer;">
                                </div>

                            </div>

                            <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:10px;">
                                <!-- Stroke Box -->
                                <div>
                                    <label style="font-size:11px; color:#555; display:block; margin-bottom:3px;">Viền chữ</label>
                                    <div style="display:flex; align-items:center; gap:8px; border:1px solid #ccc; border-radius:4px; padding:4px 6px; background:#fff;">
                                        <input id="prop-stroke" onchange="window.updateObjectProperty('Stroke', this.checked); document.getElementById('stroke-options').style.opacity = this.checked ? '1' : '0.4'; document.getElementById('stroke-options').style.pointerEvents = this.checked ? 'auto' : 'none';" type="checkbox" style="cursor:pointer; width:14px; height:14px; margin:0;">
                                        <div id="stroke-options" style="display:flex; align-items:center; gap:10px;">
                                            <div style="display:flex; align-items:center; gap:3px;">
                                                <span style="font-size:11px; color:#555;">Dày:</span>
                                                <input id="prop-strokesize" oninput="window.updateObjectProperty('StrokeSize', this.value)" type="number" step="0.5" style="width:40px; padding:2px 4px; border:1px solid #ccc; border-radius:3px;" title="Dày viền">
                                            </div>
                                            <div style="display:flex; align-items:center; gap:3px;">
                                                <span style="font-size:11px; color:#555;">Màu:</span>
                                                <input id="prop-strokecolor" oninput="window.updateObjectProperty('StrokeColor', this.value)" type="color" style="width:24px; height:24px; padding:0; border:1px solid #ccc; border-radius:3px; cursor:pointer;" title="Màu viền">
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- D-pad -->
                                <div style="display:grid; grid-template-columns: 18px 18px 18px; grid-template-rows: 18px 18px 18px; gap:2px; padding:3px; background:#f5f5f5; border-radius:4px; border:1px solid #ddd; flex-shrink:0;">
                                    <div></div>
                                    <button title="Lên 10px" onclick="window.nudgePosition(0, -10)" style="cursor:pointer; background:#fff; border:1px solid #bbb; border-radius:3px; padding:0; display:flex; align-items:center; justify-content:center; color:#333; font-size:8px;">▲</button>
                                    <div></div>
                                    <button title="Trái 10px" onclick="window.nudgePosition(-10, 0)" style="cursor:pointer; background:#fff; border:1px solid #bbb; border-radius:3px; padding:0; display:flex; align-items:center; justify-content:center; color:#333; font-size:8px;">◀</button>
                                    <button title="Giữa (0,0)" onclick="window.updateObjectProperty('OffsetX', 0); window.updateObjectProperty('OffsetY', 0); document.getElementById('prop-offsetx').value=0; document.getElementById('prop-offsety').value=0;" style="cursor:pointer; background:#e0e0e0; border:1px solid #bbb; border-radius:3px; padding:0; display:flex; align-items:center; justify-content:center; font-size:8px; font-weight:bold; color:#333;">O</button>
                                    <button title="Phải 10px" onclick="window.nudgePosition(10, 0)" style="cursor:pointer; background:#fff; border:1px solid #bbb; border-radius:3px; padding:0; display:flex; align-items:center; justify-content:center; color:#333; font-size:8px;">▶</button>
                                    <div></div>
                                    <button title="Xuống 10px" onclick="window.nudgePosition(0, 10)" style="cursor:pointer; background:#fff; border:1px solid #bbb; border-radius:3px; padding:0; display:flex; align-items:center; justify-content:center; color:#333; font-size:8px;">▼</button>
                                    <div></div>
                                </div>
                            </div>
                            
                            <input id="prop-offsetx" type="hidden">
                            <input id="prop-offsety" type="hidden">
                        </div>

                        <!-- Layer List -->
                        <div style="height: 120px; display:flex; flex-direction:column; background:#f9f9f9;">
                            <div style="padding:5px 10px; background:#e9ecef; border-bottom:1px solid #ddd; display:flex; justify-content:space-between; align-items:center;">
                                <span style="font-weight:bold; font-size:11px; color:#495057;">📑 Objects / Layers</span>
                                <button onclick="window.addObject()" style="background:#28a745; color:white; border:none; border-radius:4px; padding:3px 8px; font-size:11px; font-weight:bold; cursor:pointer;">+ Thêm</button>
                            </div>
                            <div id="edit-layer-list" style="flex:1; overflow-y:auto; padding:2px;">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="padding:10px 15px; border-top:1px solid #eee; display:flex; justify-content:space-between; gap:10px; background:#f9f9f9; border-radius:0 0 8px 8px;">
                <button type="button" onclick="document.getElementById('maketModal').remove()" style="background:#ccc; color:#333; border:none; padding:8px 15px; border-radius:4px; cursor:pointer;">Hủy</button>
                <div style="display:flex; gap:10px;">
                    <button type="button" onclick="forcePresentMaket()" style="background:#e91e63; color:white; border:none; padding:8px 15px; border-radius:4px; cursor:pointer; font-weight:bold;">Phát ngay</button>
                    <button type="button" onclick="saveMaketDetails()" style="background:#4caf50; color:white; border:none; padding:8px 20px; border-radius:4px; cursor:pointer; font-weight:bold;">Lưu & Đóng</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);

    const ro = new ResizeObserver(() => { window.updatePreview(); });
    ro.observe(document.getElementById('preview-container'));
    
    setTimeout(() => {
        window.switchTab('prop');
        window.renderLayerList();
        window.renderPropertyPanel();
        window.updatePreview();
    }, 50);
}

window.selectBackground = function(id, url) {
    currentActiveBgId = id;
    currentActiveBgUrl = url;
    let bgItems = document.querySelectorAll('.bg-item-select');
    bgItems.forEach(x => {
        if (x.getAttribute('data-id') == id) x.style.borderColor = '#4caf50';
        else x.style.borderColor = 'transparent';
    });
    window.updatePreview();
}

window.switchTab = function(tab) {
    document.getElementById('tab-bg').style.color = tab === 'bg' ? '#0d6efd' : '#555';
    document.getElementById('tab-bg').style.borderBottomColor = tab === 'bg' ? '#0d6efd' : 'transparent';
    document.getElementById('tab-content-bg').style.display = tab === 'bg' ? 'block' : 'none';
    
    document.getElementById('tab-prop').style.color = tab === 'prop' ? '#0d6efd' : '#555';
    document.getElementById('tab-prop').style.borderBottomColor = tab === 'prop' ? '#0d6efd' : 'transparent';
    document.getElementById('tab-content-prop').style.display = tab === 'prop' ? 'flex' : 'none';
}

window.renderLayerList = function() {
    let listHtml = '';
    currentMaketObjects.forEach((obj) => {
        let isActive = obj.Id == currentActiveObjectId;
        let shortText = (obj.Text || '').replace(/\n/g, ' ').trim();
        if (shortText.length > 25) shortText = shortText.substring(0, 25) + '...';
        
        listHtml += `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:5px 10px; border-bottom:1px solid #eee; background:${isActive ? '#e3f2fd' : '#fff'}; cursor:pointer; transition:0.2s;" onclick="window.selectObject('${obj.Id}')" onmouseover="this.style.background='${isActive ? '#e3f2fd' : '#f8f9fa'}'" onmouseout="this.style.background='${isActive ? '#e3f2fd' : '#fff'}'">
            <div style="flex:1; overflow:hidden; display:flex; flex-direction:column; justify-content:center;">
                <span style="font-weight:${isActive ? 'bold' : 'normal'}; color:${isActive ? '#0d6efd' : '#333'}; font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(obj.Name)}</span>
                <span style="font-size:10px; color:#666; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px;" title="${escapeHtml(obj.Text || '')}">${escapeHtml(shortText)}</span>
            </div>
            <button onclick="window.deleteObject('${obj.Id}', event)" style="background:none; border:none; color:#dc3545; cursor:pointer; font-size:14px; padding:0 5px;" title="Xóa">🗑</button>
        </div>
        `;
    });
    if (currentMaketObjects.length === 0) {
        listHtml = `<div style="padding:10px; text-align:center; color:#999; font-size:12px;">Trống</div>`;
    }
    document.getElementById('edit-layer-list').innerHTML = listHtml;
}

window.selectObject = function(id) {
    currentActiveObjectId = id;
    window.switchTab('prop');
    window.renderLayerList();
    window.renderPropertyPanel();
    window.updatePreview();
}

// Function to safely inject Box values for remote local storage
function patchLegacyMaketObjects(objects) {
    if (!objects || !Array.isArray(objects)) return;
    objects.forEach((o, i) => {
        if (o.BoxX === undefined) {
            if (i === 0) { o.BoxX=0.5; o.BoxY=0.5; o.BoxW=9; o.BoxH=0.8; o.Valign='middle'; }
            else if (i === 1) { o.BoxX=0.5; o.BoxY=1.3; o.BoxW=9; o.BoxH=1.2; o.Valign='middle'; }
            else if (i === 2) { o.BoxX=0.5; o.BoxY=2.7; o.BoxW=9; o.BoxH=2.0; o.Valign='top'; }
            else if (i === 3) { o.BoxX=3.5; o.BoxY=4.8; o.BoxW=5.5; o.BoxH=0.5; o.Valign='bottom'; }
            else { o.BoxX=0.5; o.BoxY=0.5; o.BoxW=9; o.BoxH=1.0; o.Valign='top'; }
            o.OffsetX = 0; o.OffsetY = 0; // Wipe old garbage pixel offsets
        }
    });
}

window.deleteObject = function(id, event) {
    if(event) event.stopPropagation();
    if(confirm('Bạn có chắc chắn muốn xóa đối tượng này?')) {
        currentMaketObjects = currentMaketObjects.filter(o => o.Id !== id);
        if(currentActiveObjectId === id) currentActiveObjectId = null;
        window.renderLayerList();
        window.renderPropertyPanel();
        window.updatePreview();
    }
}

window.addObject = function() {
    let baseObj = currentMaketObjects.find(x => x.Id == currentActiveObjectId) || currentMaketObjects[currentMaketObjects.length - 1] || {};
    let newObj = {
        Id: 'obj_' + Date.now() + Math.random().toString(36).substr(2, 5),
        Name: "Văn bản mới",
        Text: "Văn bản mới",
        Font: baseObj.Font || "Times New Roman",
        FontSize: baseObj.FontSize || 48,
        Color: baseObj.Color || "#ffff00",
        TextCase: baseObj.TextCase || "none",
        Stroke: baseObj.Stroke || false,
        StrokeColor: baseObj.StrokeColor || "#ff0000",
        StrokeSize: baseObj.StrokeSize || 1.5,
        OffsetX: (baseObj.OffsetX || 0),
        OffsetY: (baseObj.OffsetY || 0) + 50,
        Align: baseObj.Align || "center",
        BoxX: 0.5, BoxY: 0.5, BoxW: 9, BoxH: 1.0, Valign: 'middle'
    };
    let baseIndex = currentMaketObjects.findIndex(x => x.Id == currentActiveObjectId);
    if (baseIndex >= 0) {
        currentMaketObjects.splice(baseIndex + 1, 0, newObj);
    } else {
        currentMaketObjects.push(newObj);
    }
    currentActiveObjectId = newObj.Id;
    window.renderLayerList();
    window.renderPropertyPanel();
    window.updatePreview();
}

window.resetMaketToDefault = function() {
    if(confirm("Xoá maket tuỳ chỉnh của lịch này và khôi phục về mặc định?")) {
        if (currentMaketEvt && currentMaketEvt.Id) {
            if (window.globalMaketDetails && window.globalMaketDetails[currentMaketEvt.Id]) {
                delete window.globalMaketDetails[currentMaketEvt.Id];
                if (window.saveMaketDetails) window.saveMaketDetails();
            }
        }
        let payload = JSON.stringify({
            Action: "DELETE_EVENT_MAKET",
            EventId: currentMaketEvt ? currentMaketEvt.Id : ""
        });
        if (socket && currentDeviceId) {
            socket.emit("admin_action", currentDeviceId, "WEB_EVENT|" + payload);
        }
        alert("Đã khôi phục mặc định!");
        document.getElementById('maketModal').remove();
    }
}

window.renderPropertyPanel = function() {
    let panel = document.getElementById('edit-property-panel');
    let textArea = document.getElementById('edit-main-textarea');
    let obj = currentMaketObjects.find(o => o.Id == currentActiveObjectId);
    
    if (!obj) {
        panel.style.opacity = '0.5';
        panel.style.pointerEvents = 'none';
        document.getElementById('prop-panel-title').innerText = "Chưa chọn đối tượng";
        let xyDisp = document.getElementById('prop-xy-display');
        if (xyDisp) xyDisp.innerText = '';
        textArea.value = '';
        textArea.disabled = true;
        return;
    }
    
    panel.style.opacity = '1';
    panel.style.pointerEvents = 'auto';
    document.getElementById('prop-panel-title').innerText = "Sửa: " + obj.Name;
    textArea.value = obj.Text;
    textArea.disabled = false;
    
    document.getElementById('prop-name').value = obj.Name;
    let xyDisp = document.getElementById('prop-xy-display');
    if (xyDisp) xyDisp.innerText = `[X: ${obj.OffsetX || 0}, Y: ${obj.OffsetY || 0}]`;
    
    document.getElementById('prop-font').value = obj.Font || "Times New Roman";
    document.getElementById('prop-size').value = obj.FontSize;
    document.getElementById('prop-color').value = obj.Color;
    document.getElementById('prop-color-bar').style.background = obj.Color;
    document.getElementById('prop-case').value = obj.TextCase;
    
    document.getElementById('btn-align-left').style.background = obj.Align === 'left' ? '#e0e0e0' : 'none';
    document.getElementById('btn-align-center').style.background = obj.Align === 'center' ? '#e0e0e0' : 'none';
    document.getElementById('btn-align-right').style.background = obj.Align === 'right' ? '#e0e0e0' : 'none';
    document.getElementById('prop-stroke').checked = obj.Stroke;
    document.getElementById('stroke-options').style.opacity = obj.Stroke ? '1' : '0.4';
    document.getElementById('stroke-options').style.pointerEvents = obj.Stroke ? 'auto' : 'none';
    
    document.getElementById('prop-strokecolor').value = obj.StrokeColor;
    document.getElementById('prop-strokesize').value = obj.StrokeSize;
    document.getElementById('prop-offsetx').value = obj.OffsetX;
    document.getElementById('prop-offsety').value = obj.OffsetY;
}

window.nudgePosition = function(dx, dy) {
    if (!currentActiveObjectId) return;
    let obj = currentMaketObjects.find(o => o.Id == currentActiveObjectId);
    if (obj) {
        let curX = Number(obj.OffsetX) || 0;
        let curY = Number(obj.OffsetY) || 0;
        let newX = curX + dx;
        let newY = curY + dy;
        obj.OffsetX = newX;
        obj.OffsetY = newY;
        let pX = document.getElementById('prop-offsetx'); if (pX) pX.value = newX;
        let pY = document.getElementById('prop-offsety'); if (pY) pY.value = newY;
        let xyDisp = document.getElementById('prop-xy-display');
        if (xyDisp) xyDisp.innerText = `[X: ${newX}, Y: ${newY}]`;
        window.updatePreview();
    }
}

window.updateActiveText = function(text) {
    if (!currentActiveObjectId) return;
    let obj = currentMaketObjects.find(o => o.Id == currentActiveObjectId);
    if (obj) {
        obj.Text = text;
        window.updatePreview();
    }
}

window.updateObjectProperty = function(key, value) {
    if (!currentActiveObjectId) return;
    let obj = currentMaketObjects.find(o => o.Id == currentActiveObjectId);
    if (obj) {
        if (key === 'Stroke') obj[key] = value === 'true' || value === true;
        else if (['FontSize', 'StrokeSize', 'OffsetX', 'OffsetY'].includes(key)) obj[key] = Number(value) || 0;
        else obj[key] = value;
        
        if (key === 'OffsetX' || key === 'OffsetY') {
            let xyDisp = document.getElementById('prop-xy-display');
            if (xyDisp) xyDisp.innerText = `[X: ${obj.OffsetX || 0}, Y: ${obj.OffsetY || 0}]`;
        }
        
        if (key === 'Name') window.renderLayerList();
        window.updatePreview();
    }
}

window.updatePreview = function() {
    try {
        const container = document.getElementById('preview-container');
        const board = document.getElementById('preview-board');
        if (!container || !board) return;
        
        const scale = container.clientWidth / 1920;
        board.style.transform = `scale(${scale})`;
        
        if (currentActiveBgUrl && currentActiveBgUrl.trim() !== '') {
            board.style.background = `url('${currentActiveBgUrl}') center/cover no-repeat`;
        } else {
            board.style.background = 'radial-gradient(circle at center, #1b3a6e 0%, #0b1a2e 100%)';
        }
        
        board.innerHTML = '';
        
        currentMaketObjects.forEach(obj => {
            let text = String(obj.Text || "");
            text = text.replace(/{{EventContent}}/g, currentMaketEvtContent);
            text = text.replace(/{{EventTime}}/g, currentMaketFormattedDate);
            
            if (obj.TextCase === 'uppercase') text = text.toUpperCase();
            else if (obj.TextCase === 'lowercase') text = text.toLowerCase();
            
            let oxStr = String(obj.OffsetX !== undefined && obj.OffsetX !== null ? obj.OffsetX : 0).replace(',', '.');
            let oyStr = String(obj.OffsetY !== undefined && obj.OffsetY !== null ? obj.OffsetY : 0).replace(',', '.');
            let ox = Number(oxStr) || 0;
            let oy = Number(oyStr) || 0;

            let div = document.createElement('div');
            
            // Replicate app.js styling exactly for WYSIWYG
            div.style.position = 'absolute';
            div.style.top = '0px';
            div.style.left = '0px';
            div.style.width = '100%';
            div.style.textAlign = obj.Align || 'center';
            div.style.fontFamily = obj.Font || 'Arial';
            
            let fsize = Number(String(obj.FontSize !== undefined && obj.FontSize !== null ? obj.FontSize : 32).replace(',', '.')) || 32;
            div.style.fontSize = fsize + 'pt';
            div.style.color = obj.Color || '#FFFFFF';
            div.style.fontWeight = 'bold';
            div.style.transform = `translate(${ox}px, ${oy}px)`;
            div.style.padding = '0 40px';
            div.style.boxSizing = 'border-box';
            div.style.lineHeight = '1.2';
            div.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
            div.style.pointerEvents = 'auto';
            div.style.cursor = 'pointer';
            div.style.zIndex = '10';

            if (obj.Stroke) {
                let sSize = Number(String(obj.StrokeSize !== undefined && obj.StrokeSize !== null ? obj.StrokeSize : 1.5).replace(',', '.')) || 1.5;
                div.style.webkitTextStroke = `${sSize}px ${obj.StrokeColor || '#ff0000'}`;
            }

            if (obj.Id == currentActiveObjectId) {
                div.style.outline = '3px dashed #dc3545';
                div.style.outlineOffset = '5px';
                div.style.zIndex = '100';
            }

            div.onclick = function(e) { 
                e.stopPropagation();
                window.selectObject(obj.Id); 
            };
            
            div.innerHTML = text.replace(/\\n/g, "<br>").replace(/\n/g, "<br>");
            board.appendChild(div);
        });
    } catch (err) {
        console.error(err);
        alert("Lỗi updatePreview: " + err.message);
    }
};

window.getFormData = function() {
    return {
        MaketObjects: currentMaketObjects,
        activeBgId: currentActiveBgId,
        activeBgUrl: currentActiveBgUrl
    };
}

window.forcePresentMaket = function() {
    if (!socket || !currentDeviceId) {
        alert("Chưa kết nối máy chủ");
        return;
    }
    let config = window.getFormData();
    let evalConfig = JSON.parse(JSON.stringify(config));
    if (evalConfig.MaketObjects) {
        evalConfig.MaketObjects.forEach(obj => {
            let text = obj.Text || "";
            text = text.replace(/{{EventContent}}/g, currentMaketEvtContent);
            text = text.replace(/{{EventTime}}/g, currentMaketFormattedDate);
            obj.Text = text;
        });
    }

    let payload = JSON.stringify({
        Action: "FORCE_MAKET",
        Config: evalConfig
    });
    socket.emit("admin_action", currentDeviceId, "WEB_EVENT|" + payload);
};
window.saveMaketDetails = function() {
    syncQueue = syncQueue.then(async () => {
        const evId = currentMaketEvt.Id;
        if (!evId) return;
        
        const conf = window.getFormData();
        window.globalMaketDetails[evId] = conf;
        
        // Upload to Github
        setStatus("Đang lưu Maket lên máy chủ...");
        renderMaketList();
        
        try {
            const plainJson = JSON.stringify(globalMaketDetails, null, 2);
            const encJson = await encryptAES(plainJson, PAT);
            const b64 = btoa(unescape(encodeURIComponent(encJson)));
            
            let updateRes = await updateFileContent(OWNER, REPO_NAME, "maket_details.json", "Cập nhật maket", b64, currentMaketDetailsSha);
            
            if (updateRes && updateRes.commit) {
                currentMaketDetailsSha = updateRes.content.sha;
                setStatus("Lưu thành công!");
                setTimeout(() => setStatus(""), 3000);
            } else if (updateRes && updateRes.status === 409) {
                // Conflict handling
                try {
                    const serverShaRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO_NAME}/contents/maket_details.json`, {
                        headers: { 'Authorization': 'token ' + PAT }
                    });
                    if (serverShaRes.ok) {
                        const serverD = await serverShaRes.json();
                        let serverData = {};
                        if (serverD.content) {
                            const serverContentDec = await decryptAES(decodeURIComponent(escape(atob(serverD.content))), PAT);
                            serverData = JSON.parse(serverContentDec);
                        }
                        serverData[evId] = conf;
                        window.globalMaketDetails = serverData;
                        
                        const newPlainJson = JSON.stringify(serverData, null, 2);
                        const newEncJson = await encryptAES(newPlainJson, PAT);
                        const newB64 = btoa(unescape(encodeURIComponent(newEncJson)));
                        
                        let retryRes = await updateFileContent(OWNER, REPO_NAME, "maket_details.json", "Auto merge maket", newB64, serverD.sha);
                        if (retryRes && retryRes.commit) {
                            currentMaketDetailsSha = retryRes.content.sha;
                            setStatus("Lưu thành công (sau merge)!");
                            setTimeout(() => setStatus(""), 3000);
                        }
                    }
                } catch(e) {
                    setStatus("Lỗi lưu Maket: " + e.message);
                }
            } else {
                setStatus("Lỗi lưu Maket: " + (updateRes ? updateRes.message : "Unknown error"));
            }
        } catch(e) {
            setStatus("Lỗi lưu Maket: " + e.message);
        }
        document.getElementById('maketModal').remove();
    });
};
